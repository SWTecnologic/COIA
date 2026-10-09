"""
eventos.py — Agrupamento de ocorrências em eventos

Quando várias ocorrências do mesmo tipo aparecem na mesma região em um
intervalo curto, o COIA sobe tudo para um EVENTO único.

Exemplo:
  3 ocorrências de "sem_energia" no Grande BH em 30min
  → vira 1 evento "Falha em massa — Grande BH"
  → ocorrencias.evento_id aponta pro evento
  → ia_eventos registra a decisão
"""

import random
import logging
from datetime import datetime, timedelta, timezone
from app.db import sb
from app.modulos.correlacao import haversine_m

log = logging.getLogger(__name__)

JANELA_MIN = 30
MIN_OCORRENCIAS = 1
RAIO_KM = 5.0


def _codigo_evento() -> str:
    ano = datetime.now().year
    return f"EV-{ano}-{random.randint(1, 9999):04d}"


def _nome_evento(tipo: str, regiao_nome: str | None) -> str:
    base = {
        "sem_energia": "Falha coletiva",
        "cabo_rompido": "Rompimento de cabo",
        "cabo_no_chao": "Cabo no solo",
        "poste_danificado": "Postes danificados",
        "transformador": "Falhas de transformador",
        "curto_circuito": "Curtos-circuitos",
        "arvore_sobre_rede": "Árvores sobre a rede",
        "oscilacao": "Oscilações de tensão",
        "falha_equipamento": "Falhas de equipamento",
    }.get(tipo, "Evento operacional")
    if regiao_nome:
        return f"{base} — {regiao_nome}"
    return base


def _buscar_regiao_nome(regiao_id: str | None) -> str | None:
    if not regiao_id:
        return None
    resp = (sb().table("regioes").select("nome")
              .eq("id", regiao_id).limit(1).execute()).data
    return resp[0]["nome"] if resp else None


def processar_ocorrencia(ocorrencia_id: str) -> dict:
    oc = (sb().table("ocorrencias").select("*").eq("id", ocorrencia_id)
            .single().execute()).data
    if not oc:
        return {"acao": "nao_encontrada"}

    if oc.get("evento_id"):
        return {"acao": "ja_em_evento", "evento_id": oc["evento_id"]}

    tipo = oc.get("tipo")
    if not tipo:
        return {"acao": "sem_tipo"}

    desde = (datetime.now(timezone.utc) - timedelta(minutes=JANELA_MIN)).isoformat()

    # Outras ocorrências do mesmo tipo na janela
    outras = (sb().table("ocorrencias")
                .select("id, latitude, longitude, evento_id, regiao_id")
                .eq("tipo", tipo)
                .gte("data_hora_criacao", desde)
                .neq("id", ocorrencia_id)
                .execute()).data or []

    # Filtra por proximidade (mesmo "bairro")
    proximas = []
    for o in outras:
        d = haversine_m(oc["latitude"], oc["longitude"],
                        o["latitude"], o["longitude"])
        if d <= RAIO_KM * 1000:
            proximas.append({**o, "distancia_m": d})

    total = len(proximas) + 1
    if total < MIN_OCORRENCIAS:
        return {"acao": "aguardando", "total_proximas": total}

    # Já existe evento recente pra mesma região + tipo?
    eventos_recentes = (sb().table("eventos")
                          .select("*")
                          .eq("regiao_id", oc["regiao_id"])
                          .eq("status", "ativo")
                          .gte("data_inicio", desde)
                          .execute()).data or []

    if eventos_recentes:
        evento = eventos_recentes[0]
        log.info(f"COIA vinculou ocorrência a evento existente {evento['codigo']}")
    else:
        regiao_nome = _buscar_regiao_nome(oc.get("regiao_id"))
        evento = (sb().table("eventos").insert({
            "codigo": _codigo_evento(),
            "nome": _nome_evento(tipo, regiao_nome),
            "tipo": tipo,
            "regiao_id": oc["regiao_id"],
            "municipio_id": oc["municipio_id"],
            "status": "ativo",
            "observacoes": f"Detectado pelo COIA com {total} ocorrências",
        }).execute()).data[0]
        log.info(f"COIA criou evento {evento['codigo']} ({evento['id']})")

    # Amarram todas as ocorrências ao evento
    todos_ids = [oc["id"]] + [p["id"] for p in proximas]
    for oid in todos_ids:
        sb().table("ocorrencias").update({"evento_id": evento["id"]})\
            .eq("id", oid).execute()

    # Registra decisão em ia_eventos
    consumidores_total = 0
    todas_oc = (sb().table("ocorrencias")
                  .select("consumidores_afetados")
                  .eq("evento_id", evento["id"])
                  .execute()).data or []
    for o in todas_oc:
        consumidores_total += o.get("consumidores_afetados") or 0

    # Se já existe ia_eventos pro evento, atualiza; senão, insere
    existente = (sb().table("ia_eventos").select("id")
                   .eq("evento_id", evento["id"])
                   .limit(1).execute()).data
    payload = {
        "evento_id": evento["id"],
        "codigo": evento["codigo"],
        "tipo": tipo,
        "nivel_confianca": 0.85,
        "motivo": (
            f"{len(todos_ids)} ocorrências do tipo '{tipo}' "
            f"num raio de {RAIO_KM}km em {JANELA_MIN}min"
        ),
        "total_chamados": 0,
        "total_ocorrencias": len(todas_oc),
        "consumidores_afetados": consumidores_total,
        "ativo": True,
        "atualizado_em": datetime.now(timezone.utc).isoformat(),
    }
    if existente:
        sb().table("ia_eventos").update(payload).eq("id", existente[0]["id"]).execute()
    else:
        sb().table("ia_eventos").insert(payload).execute()

    return {
        "acao": "evento_criado" if not eventos_recentes else "evento_reutilizado",
        "evento_id": evento["id"],
        "codigo": evento["codigo"],
        "total_ocorrencias": len(todas_oc),
        "consumidores": consumidores_total,
    }