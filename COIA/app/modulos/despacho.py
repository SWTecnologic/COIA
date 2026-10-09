"""
despacho.py — Escolha da equipe apta para uma ocorrência

Etapa A (FILTRO DE ELEGIBILIDADE):
  Elimina equipes que NÃO PODEM atender (falta de habilitação, especialidade,
  equipamento ou veículo inadequado). Não adianta estar perto se não pode.

Etapa B (RANKING POR SCORE):
  Entre as equipes elegíveis, calcula pontuação:
    40% proximidade
    20% match de especialidade
    15% match de habilitação
    15% match de equipamento
    10% bônus de mesma região
"""

from app.db import sb
from app.modulos.correlacao import haversine_m

# ============================================================
# REGRAS: o que cada tipo de ocorrência EXIGE
# ============================================================
# - especialidades: códigos que a equipe DEVE ter (pelo menos 1)
# - habilitacoes: códigos que pelo menos 1 técnico DEVE ter
# - veiculo_contem: substring do tipo de veículo obrigatório
# - equipamento_categoria: categoria de equipamento obrigatória

REQUISITOS = {
    "poste_danificado": {
        "especialidades": ["ESP-001", "ESP-002"],
        "habilitacoes": ["HAB-003"],           # NR-35 trabalho em altura
        "veiculo_contem": None,
        "equipamento_categoria": None,
        "descricao": "Poste danificado exige trabalho em altura (NR-35)",
    },
    "transformador": {
        "especialidades": ["ESP-004"],          # Transformadores
        "habilitacoes": ["HAB-001"],            # NR-10
        "veiculo_contem": "cesta",              # Caminhão cesta
        "equipamento_categoria": None,
        "descricao": "Transformador exige caminhão cesta e especialidade",
    },
    "cabo_rompido": {
        "especialidades": ["ESP-001"],          # Rede Primária
        "habilitacoes": ["HAB-001"],
        "veiculo_contem": None,
        "equipamento_categoria": None,
        "descricao": "Cabo rompido exige rede primária",
    },
    "cabo_no_chao": {
        "especialidades": ["ESP-001", "ESP-002"],
        "habilitacoes": ["HAB-001"],
        "veiculo_contem": None,
        "equipamento_categoria": None,
        "descricao": "Cabo no solo exige rede primária ou secundária",
    },
    "curto_circuito": {
        "especialidades": ["ESP-001", "ESP-006"],   # Rede Primária ou Manobras
        "habilitacoes": ["HAB-001"],
        "veiculo_contem": None,
        "equipamento_categoria": None,
        "descricao": "Curto-circuito exige rede primária ou manobras",
    },
    "arvore_sobre_rede": {
        "especialidades": ["ESP-002", "ESP-005"],
        "habilitacoes": ["HAB-003"],            # NR-35 (subir pra podar)
        "veiculo_contem": None,
        "equipamento_categoria": None,
        "descricao": "Árvore sobre rede exige NR-35 e rede secundária/altura",
    },
    "falha_equipamento": {
        "especialidades": [],
        "habilitacoes": ["HAB-001"],
        "veiculo_contem": None,
        "equipamento_categoria": None,
        "descricao": "Falha de equipamento exige NR-10",
    },
    "sem_energia": {
        "especialidades": [],
        "habilitacoes": [],
        "veiculo_contem": None,
        "equipamento_categoria": None,
        "descricao": "Sem energia não tem requisito especial",
    },
    "oscilacao": {
        "especialidades": [],
        "habilitacoes": [],
        "veiculo_contem": None,
        "equipamento_categoria": None,
        "descricao": "Oscilação não tem requisito especial",
    },
}

REQUISITOS_PADRAO = {
    "especialidades": [],
    "habilitacoes": [],
    "veiculo_contem": None,
    "equipamento_categoria": None,
    "descricao": "Sem requisitos específicos",
}

# ============================================================
# HELPERS
# ============================================================

def _buscar_dados_equipes(equipe_ids: list[str]) -> dict:
    """Busca em lote tudo que precisa sobre as equipes."""
    if not equipe_ids:
        return {"especialidades": {}, "equipamentos": {}, "tecnicos": {}, "habilitacoes": {}}

    # Especialidades por equipe
    esp_rows = (sb().table("equipe_especialidades")
                  .select("equipe_id, especialidade_id, nivel, ativo")
                  .in_("equipe_id", equipe_ids)
                  .eq("ativo", True)
                  .execute()).data or []
    especialidades_map: dict[str, set] = {}
    for r in esp_rows:
        especialidades_map.setdefault(r["equipe_id"], set()).add(r["especialidade_id"])

    # Equipamentos por equipe
    eqp_rows = (sb().table("equipamentos_equipe")
                  .select("equipe_id, categoria, status")
                  .in_("equipe_id", equipe_ids)
                  .execute()).data or []
    equipamentos_map: dict[str, list] = {}
    for r in eqp_rows:
        equipamentos_map.setdefault(r["equipe_id"], []).append(r)

    # Técnicos por equipe (via equipe_tecnicos)
    et_rows = (sb().table("equipe_tecnicos")
                 .select("equipe_id, tecnico_id")
                 .in_("equipe_id", equipe_ids)
                 .execute()).data or []
    tecnicos_map: dict[str, list] = {}
    tecnico_ids = []
    for r in et_rows:
        tecnicos_map.setdefault(r["equipe_id"], []).append(r["tecnico_id"])
        tecnico_ids.append(r["tecnico_id"])

    # Habilitações dos técnicos
    hab_rows = []
    if tecnico_ids:
        hab_rows = (sb().table("tecnico_habilitacoes")
                      .select("tecnico_id, habilitacao_id, status")
                      .in_("tecnico_id", tecnico_ids)
                      .eq("status", "valida")
                      .execute()).data or []
    habilitacoes_map: dict[str, set] = {}
    for r in hab_rows:
        habilitacoes_map.setdefault(r["tecnico_id"], set()).add(r["habilitacao_id"])

    return {
        "especialidades": especialidades_map,
        "equipamentos": equipamentos_map,
        "tecnicos": tecnicos_map,
        "habilitacoes": habilitacoes_map,
    }


def _avaliar_elegibilidade(
    eq: dict,
    req: dict,
    especialidades_eq: set,
    equipamentos_eq: list,
    tecnicos_eq: list,
    habilitacoes_por_tecnico: dict,
    veiculo: dict | None,
) -> tuple[bool, str | None, dict]:
    """Retorna (elegivel, motivo_inelegibilidade, detalhes)."""
    detalhes = {
        "especialidades_ok": True,
        "habilitacoes_ok": True,
        "veiculo_ok": True,
        "equipamento_ok": True,
    }

    # --- Especialidade ---
    esp_necessarias = req.get("especialidades") or []
    if esp_necessarias:
        if not (set(esp_necessarias) & especialidades_eq):
            detalhes["especialidades_ok"] = False
            return False, (
                f"Falta especialidade: precisa de uma entre "
                f"{', '.join(esp_necessarias)}"
            ), detalhes

    # --- Habilitação ---
    hab_necessarias = req.get("habilitacoes") or []
    if hab_necessarias:
        tem_alguma = False
        for tid in tecnicos_eq:
            if set(hab_necessarias) & habilitacoes_por_tecnico.get(tid, set()):
                tem_alguma = True
                break
        if not tem_alguma:
            detalhes["habilitacoes_ok"] = False
            return False, (
                f"Nenhum técnico tem habilitação: "
                f"{', '.join(hab_necessarias)}"
            ), detalhes

    # --- Veículo ---
    veiculo_contem = req.get("veiculo_contem")
    if veiculo_contem:
        if not veiculo:
            detalhes["veiculo_ok"] = False
            return False, "Sem veículo designado", detalhes
        tipo_veic = (veiculo.get("tipo") or "").lower()
        if veiculo_contem.lower() not in tipo_veic:
            detalhes["veiculo_ok"] = False
            return False, (
                f"Veículo inadequado (precisa {veiculo_contem}, "
                f"tem {veiculo.get('tipo')})"
            ), detalhes

    # --- Equipamento ---
    cat_nec = req.get("equipamento_categoria")
    if cat_nec:
        categorias = [e.get("categoria") for e in equipamentos_eq]
        if cat_nec not in categorias:
            detalhes["equipamento_ok"] = False
            return False, f"Falta equipamento da categoria {cat_nec}", detalhes

    return True, None, detalhes


def _pontuar(
    elegivel: bool,
    distancia_m: float,
    esp_match: bool,
    hab_match: bool,
    eqp_match: bool,
    mesma_regiao: bool,
) -> float:
    if not elegivel:
        return 0.0

    # proximidade: 1.0 se dist=0, 0.0 se dist>=50km
    prox = max(0.0, 1.0 - distancia_m / 50_000)

    score = (
        0.40 * prox
        + 0.20 * (1.0 if esp_match else 0.4)   # quem casa ganha 100%; quem não casa (mas é elegível) ganha 40%
        + 0.15 * (1.0 if hab_match else 0.5)
        + 0.15 * (1.0 if eqp_match else 0.5)
        + 0.10 * (1.0 if mesma_regiao else 0.0)
    )
    return round(score, 3)


# ============================================================
# ENTRADA PRINCIPAL
# ============================================================

def processar(ocorrencia_id: str) -> dict:
    oc = (sb().table("ocorrencias").select("*").eq("id", ocorrencia_id)
            .single().execute()).data
    if not oc:
        return {"erro": "nao_encontrada"}

    tipo = oc.get("tipo") or "outro"
    req = REQUISITOS.get(tipo, REQUISITOS_PADRAO)

    # 1. Equipes disponíveis
    equipes = (sb().table("equipes").select("*")
                 .eq("status", "disponivel").execute()).data or []

    if not equipes:
        # grava resultado vazio
        sb().table("ia_recomendacoes_equipes").delete()\
            .eq("ocorrencia_id", ocorrencia_id).execute()
        return {
            "ocorrencia_id": ocorrencia_id,
            "top": None,
            "total_avaliadas": 0,
            "motivo": "Sem equipes disponíveis",
        }

    equipe_ids = [e["id"] for e in equipes]

    # 2. Dados auxiliares em lote
    dados = _buscar_dados_equipes(equipe_ids)

    # 3. Última localização de cada equipe
    locs = (sb().table("localizacoes_equipes").select("*")
              .order("data_hora", desc=True).execute()).data or []
    ult_loc: dict[str, dict] = {}
    for l in locs:
        ult_loc.setdefault(l["equipe_id"], l)

    # 4. Bases
    bases = (sb().table("bases_operacionais").select("*").execute()).data or []
    base_por_id = {b["id"]: b for b in bases}

    # 5. Veículos
    veiculos = (sb().table("veiculos").select("*").execute()).data or []
    veiculo_por_id = {v["id"]: v for v in veiculos}

    # 6. Avaliar cada equipe
    ranking = []
    for eq in equipes:
        eid = eq["id"]

        # Distância
        loc = ult_loc.get(eid)
        if loc:
            d = haversine_m(oc["latitude"], oc["longitude"],
                            loc["latitude"], loc["longitude"])
        else:
            b = base_por_id.get(eq["base_operacional_id"])
            d = (haversine_m(oc["latitude"], oc["longitude"],
                             b["latitude"], b["longitude"])
                 if b else 999_000)

        # Dados da equipe
        esp_eq = dados["especialidades"].get(eid, set())
        eqp_eq = dados["equipamentos"].get(eid, [])
        tec_eq = dados["tecnicos"].get(eid, [])
        hab_por_tec = dados["habilitacoes"]
        veic = veiculo_por_id.get(eq.get("veiculo_id"))

        # Elegibilidade
        elegivel, motivo_ineleg, det = _avaliar_elegibilidade(
            eq, req, esp_eq, eqp_eq, tec_eq, hab_por_tec, veic
        )

        # Matches (para pontuar)
        esp_nec = req.get("especialidades") or []
        hab_nec = req.get("habilitacoes") or []
        cat_nec = req.get("equipamento_categoria")

        esp_match = bool(set(esp_nec) & esp_eq) if esp_nec else True
        hab_match = False
        if hab_nec:
            for tid in tec_eq:
                if set(hab_nec) & hab_por_tec.get(tid, set()):
                    hab_match = True
                    break
        else:
            hab_match = True
        eqp_match = True
        if cat_nec:
            eqp_match = any(e.get("categoria") == cat_nec for e in eqp_eq)

        mesma_regiao = eq["regiao_id"] == oc["regiao_id"]

        pontuacao = _pontuar(
            elegivel, d, esp_match, hab_match, eqp_match, mesma_regiao
        )

        eta = int(d / 1000 / 40 * 60) if d < 900_000 else None

        ranking.append({
            "equipe_id": eid,
            "equipe_nome": eq["nome"],
            "elegivel": elegivel,
            "motivo_inelegibilidade": motivo_ineleg,
            "distancia_m": d,
            "distancia_km": round(d / 1000, 2),
            "eta_minutos": eta,
            "pontuacao": pontuacao,
            "detalhes": det,
        })

    # 7. Ordenar: elegíveis primeiro (por pontuação), depois inelegíveis
    elegiveis = [r for r in ranking if r["elegivel"]]
    inelegiveis = [r for r in ranking if not r["elegivel"]]
    elegiveis.sort(key=lambda x: x["pontuacao"], reverse=True)
    inelegiveis.sort(key=lambda x: x["distancia_m"])
    final = elegiveis + inelegiveis

    # 8. Limpar e gravar
    sb().table("ia_recomendacoes_equipes").delete()\
        .eq("ocorrencia_id", ocorrencia_id).execute()

    for i, r in enumerate(final[:15]):
        sb().table("ia_recomendacoes_equipes").insert({
            "ocorrencia_id": ocorrencia_id,
            "equipe_id": r["equipe_id"],
            "elegivel": r["elegivel"],
            "motivo_inelegibilidade": r["motivo_inelegibilidade"],
            "distancia_km": r["distancia_km"],
            "eta_minutos": r["eta_minutos"],
            "pontuacao": r["pontuacao"],
            "posicao": i + 1,
            "detalhes": {
                **r["detalhes"],
                "equipe_nome": r["equipe_nome"],
                "motivo_regra": req.get("descricao"),
            },
        }).execute()

    # 9. Top = melhor elegível
    top = elegiveis[0] if elegiveis else None
    if top:
        sb().table("ocorrencias").update({
            "ia_equipe_recomendada_id": top["equipe_id"],
        }).eq("id", ocorrencia_id).execute()

    return {
        "ocorrencia_id": ocorrencia_id,
        "tipo": tipo,
        "requisitos": req.get("descricao"),
        "top": top,
        "total_avaliadas": len(final),
        "elegiveis": len(elegiveis),
        "inelegiveis": len(inelegiveis),
    }