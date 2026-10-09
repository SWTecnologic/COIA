"""
correlacao.py — Agrupamento de chamados em ocorrências

Versão COIA v1.2 — permissiva e multi-idioma

- MIN_CHAMADOS = 1 → todo chamado vira ocorrência
- Grupos normalizados → "Falta de energia" e "sem_energia" contam juntos
- Cada chamado novo se junta a uma ocorrência vizinha se compatível
"""

import math
import random
import logging
from datetime import datetime, timedelta, timezone
from app.db import sb

log = logging.getLogger(__name__)

# Configurações
RAIO_M = 1000
JANELA_MIN = 60
MIN_CHAMADOS = 1     # <-- Cada chamado vira ocorrência

# ------------------------------------------------------------
# GRUPOS: agrupa variações de escrita do MESMO problema
# ------------------------------------------------------------
GRUPOS = {
    "falta_energia": {
        "sem_energia",
        "Falta de energia",
        "Queda de energia",
        "Sem energia",
        "TO-001",
    },
    "cabo_caido": {
        "cabo_rompido",
        "cabo_no_chao",
        "Fio caído",
        "Fio no chão",
        "TO-002",
        "TO-003",
    },
    "poste": {
        "poste_danificado",
        "Poste danificado",
        "TO-005",
    },
    "equipamento": {
        "transformador",
        "falha_equipamento",
        "TO-006",
        "TO-007",
    },
    "arvore": {
        "arvore_sobre_rede",
        "Árvore sobre rede",
        "TO-008",
    },
    "medicao": {
        "oscilacao",
        "Medidor com defeito",
        "Lâmpada apagada",
        "TO-009",
    },
    "emergencia": {
        "incendio",
        "curto_circuito",
        "acidente",
        "TO-004",
        "TO-010",
    },
    "outro": {
        "outro",
    },
}


def _grupo_de(tipo: str) -> str:
    """Dado um tipo, retorna o grupo semântico dele."""
    if not tipo:
        return "outro"
    t = tipo.strip()
    for grupo, variacoes in GRUPOS.items():
        if t in variacoes:
            return grupo
    return "outro"


def _tipos_do_grupo(grupo: str) -> list:
    """Dado um grupo, retorna TODOS os tipos que pertencem a ele."""
    return list(GRUPOS.get(grupo, {grupo}))


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    R = 6371000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * \
        math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _protocolo():
    return f"OC-{datetime.now().year}-{random.randint(1, 999999):06d}"


def processar_chamado(chamado_id: str) -> dict:
    resp = (sb().table("chamados").select("*").eq("id", chamado_id)
              .single().execute())
    if not resp.data:
        return {"acao": "nao_encontrado"}

    chamado = resp.data
    if chamado.get("ocorrencia_id"):
        return {"acao": "ja_vinculado", "ocorrencia_id": chamado["ocorrencia_id"]}

    tipo = chamado.get("tipo") or "outro"
    grupo = _grupo_de(tipo)
    tipos_ok = _tipos_do_grupo(grupo)

    desde = (datetime.now(timezone.utc) - timedelta(minutes=JANELA_MIN)).isoformat()

    # ------------------------------------------------------------
    # 1. Chamados vizinhos do MESMO GRUPO
    # ------------------------------------------------------------
    viz = (sb().table("chamados")
             .select("id, latitude, longitude, ocorrencia_id, tipo, regiao_id")
             .in_("tipo", tipos_ok)
             .gte("data_hora", desde)
             .neq("id", chamado_id)
             .execute()).data or []

    proximos = []
    for c in viz:
        d = haversine_m(
            chamado["latitude"], chamado["longitude"],
            c["latitude"], c["longitude"],
        )
        mesma_regiao = c.get("regiao_id") == chamado.get("regiao_id")
        if d <= RAIO_M or (mesma_regiao and d <= RAIO_M * 2):
            proximos.append({**c, "distancia_m": d, "mesma_regiao": mesma_regiao})

    # ------------------------------------------------------------
    # 2. Ocorrência existente do mesmo grupo no raio/janela
    # ------------------------------------------------------------
    ocs = (sb().table("ocorrencias")
             .select("id, latitude, longitude, tipo, regiao_id")
             .in_("tipo", tipos_ok)
             .gte("data_hora_criacao", desde)
             .execute()).data or []

    ocorrencia_id = None
    for oc in ocs:
        d = haversine_m(
            chamado["latitude"], chamado["longitude"],
            oc["latitude"], oc["longitude"],
        )
        mesma_regiao = oc.get("regiao_id") == chamado.get("regiao_id")
        if d <= RAIO_M or (mesma_regiao and d <= RAIO_M * 2):
            ocorrencia_id = oc["id"]
            log.info(f"COIA vinculou a ocorrência existente {ocorrencia_id}")
            break

    # ------------------------------------------------------------
    # 3. Criar nova ocorrência se necessário (MIN_CHAMADOS = 1)
    # ------------------------------------------------------------
    criou_nova = False
    if not ocorrencia_id:
        total = len(proximos) + 1
        if total < MIN_CHAMADOS:
            return {"acao": "aguardando", "total_proximos": total, "grupo": grupo}

        protocolo = _protocolo()
        nova = (sb().table("ocorrencias").insert({
            "protocolo": protocolo,
            "origem": chamado.get("origem") or "sistema",
            "tipo": tipo,
            "descricao": f"Agrupamento COIA ({grupo}): {total} chamado(s) — tipo base '{tipo}'",
            "latitude": chamado["latitude"],
            "longitude": chamado["longitude"],
            "regiao_id": chamado["regiao_id"],
            "municipio_id": chamado["municipio_id"],
            "status": "nova",
            "prioridade": "ordem_chamada",
            "consumidores_afetados": max(total, 10),
        }).execute()).data[0]
        ocorrencia_id = nova["id"]
        criou_nova = True
        log.info(f"COIA criou ocorrência {protocolo} ({ocorrencia_id}) — grupo '{grupo}'")

    # ------------------------------------------------------------
    # 4. Vincular chamado âncora
    # ------------------------------------------------------------
    sb().table("chamados").update({"ocorrencia_id": ocorrencia_id}) \
        .eq("id", chamado_id).execute()
    sb().table("ia_correlacoes").insert({
        "ocorrencia_id": ocorrencia_id,
        "chamado_id": chamado_id,
        "distancia_m": 0,
        "minutos_diferenca": 0,
        "score": 0.9,
        "motivo": f"Âncora do grupo '{grupo}' (tipo {tipo})",
    }).execute()

    # ------------------------------------------------------------
    # 5. Vincular vizinhos ainda não vinculados
    # ------------------------------------------------------------
    vinculados = 1
    for c in proximos:
        if c.get("ocorrencia_id"):
            continue
        sb().table("chamados").update({"ocorrencia_id": ocorrencia_id}) \
            .eq("id", c["id"]).execute()
        sb().table("ia_correlacoes").insert({
            "ocorrencia_id": ocorrencia_id,
            "chamado_id": c["id"],
            "distancia_m": round(c["distancia_m"], 2),
            "minutos_diferenca": 0,
            "score": 0.85,
            "motivo": f"{c['distancia_m']:.0f}m do âncora, grupo '{grupo}'",
        }).execute()
        vinculados += 1

    return {
        "acao": "criou_ocorrencia" if criou_nova else "vinculado",
        "ocorrencia_id": ocorrencia_id,
        "grupo": grupo,
        "total_chamados": vinculados,
    }