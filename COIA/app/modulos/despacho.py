
"""
despacho.py — Escolha e despacho automático de equipes.

Etapa A: filtra equipes elegíveis de acordo com especialidades,
habilitações, veículo e equipamentos necessários.

Etapa B: classifica as equipes elegíveis por pontuação:
    40% proximidade
    20% especialidade
    15% habilitação
    15% equipamento
    10% mesma região

Etapa C: salva o ranking, atualiza a recomendação da ocorrência
e cria uma oferta em despachos_ocorrencias para a melhor equipe.
"""

from datetime import datetime, timedelta, timezone

from app.db import sb
from app.modulos.correlacao import haversine_m


# ============================================================
# REGRAS DE ELEGIBILIDADE
# ============================================================

REQUISITOS = {
    "poste_danificado": {
        "especialidades": ["ESP-001", "ESP-002"],
        "habilitacoes": ["HAB-003"],
        "veiculo_contem": None,
        "equipamento_categoria": None,
        "descricao": "Poste danificado exige trabalho em altura (NR-35)",
    },
    "transformador": {
        "especialidades": ["ESP-004"],
        "habilitacoes": ["HAB-001"],
        "veiculo_contem": "cesta",
        "equipamento_categoria": None,
        "descricao": "Transformador exige caminhão cesta e especialidade",
    },
    "cabo_rompido": {
        "especialidades": ["ESP-001"],
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
        "especialidades": ["ESP-001", "ESP-006"],
        "habilitacoes": ["HAB-001"],
        "veiculo_contem": None,
        "equipamento_categoria": None,
        "descricao": "Curto-circuito exige rede primária ou manobras",
    },
    "arvore_sobre_rede": {
        "especialidades": ["ESP-002", "ESP-005"],
        "habilitacoes": ["HAB-003"],
        "veiculo_contem": None,
        "equipamento_categoria": None,
        "descricao": "Árvore sobre rede exige NR-35 e especialidade",
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
# CONSULTAS AUXILIARES
# ============================================================

def _buscar_dados_equipes(equipe_ids: list[str]) -> dict:
    """Busca especialidades, equipamentos, técnicos e habilitações."""

    if not equipe_ids:
        return {
            "especialidades": {},
            "equipamentos": {},
            "tecnicos": {},
            "habilitacoes": {},
        }

    especialidades_map = {}
    equipamentos_map = {}
    tecnicos_map = {}
    habilitacoes_map = {}

    esp_rows = (
        sb()
        .table("equipe_especialidades")
        .select("equipe_id, especialidade_id, nivel, ativo")
        .in_("equipe_id", equipe_ids)
        .eq("ativo", True)
        .execute()
        .data
        or []
    )

    for row in esp_rows:
        especialidades_map.setdefault(row["equipe_id"], set()).add(
            row["especialidade_id"]
        )

    eqp_rows = (
        sb()
        .table("equipamentos_equipe")
        .select("equipe_id, categoria, status")
        .in_("equipe_id", equipe_ids)
        .execute()
        .data
        or []
    )

    for row in eqp_rows:
        equipamentos_map.setdefault(row["equipe_id"], []).append(row)

    tecnico_rows = (
        sb()
        .table("equipe_tecnicos")
        .select("equipe_id, tecnico_id")
        .in_("equipe_id", equipe_ids)
        .execute()
        .data
        or []
    )

    tecnico_ids = []

    for row in tecnico_rows:
        tecnicos_map.setdefault(row["equipe_id"], []).append(
            row["tecnico_id"]
        )
        tecnico_ids.append(row["tecnico_id"])

    if tecnico_ids:
        hab_rows = (
            sb()
            .table("tecnico_habilitacoes")
            .select("tecnico_id, habilitacao_id, status")
            .in_("tecnico_id", tecnico_ids)
            .eq("status", "valida")
            .execute()
            .data
            or []
        )

        for row in hab_rows:
            habilitacoes_map.setdefault(row["tecnico_id"], set()).add(
                row["habilitacao_id"]
            )

    return {
        "especialidades": especialidades_map,
        "equipamentos": equipamentos_map,
        "tecnicos": tecnicos_map,
        "habilitacoes": habilitacoes_map,
    }


# ============================================================
# ELEGIBILIDADE
# ============================================================

def _avaliar_elegibilidade(
    eq: dict,
    req: dict,
    especialidades_eq: set,
    equipamentos_eq: list,
    tecnicos_eq: list,
    habilitacoes_por_tecnico: dict,
    veiculo: dict | None,
) -> tuple[bool, str | None, dict]:
    """Determina se a equipe pode atender à ocorrência."""

    detalhes = {
        "especialidades_ok": True,
        "habilitacoes_ok": True,
        "veiculo_ok": True,
        "equipamento_ok": True,
    }

    especialidades_necessarias = req.get("especialidades") or []

    if especialidades_necessarias:
        if not (
            set(especialidades_necessarias) & especialidades_eq
        ):
            detalhes["especialidades_ok"] = False

            return (
                False,
                "Falta especialidade: precisa de uma entre "
                + ", ".join(especialidades_necessarias),
                detalhes,
            )

    habilitacoes_necessarias = req.get("habilitacoes") or []

    if habilitacoes_necessarias:
        tem_habilitacao = any(
            set(habilitacoes_necessarias)
            & habilitacoes_por_tecnico.get(tecnico_id, set())
            for tecnico_id in tecnicos_eq
        )

        if not tem_habilitacao:
            detalhes["habilitacoes_ok"] = False

            return (
                False,
                "Nenhum técnico tem habilitação: "
                + ", ".join(habilitacoes_necessarias),
                detalhes,
            )

    veiculo_necessario = req.get("veiculo_contem")

    if veiculo_necessario:
        if not veiculo:
            detalhes["veiculo_ok"] = False
            return False, "Sem veículo designado", detalhes

        tipo_veiculo = (veiculo.get("tipo") or "").lower()

        if veiculo_necessario.lower() not in tipo_veiculo:
            detalhes["veiculo_ok"] = False

            return (
                False,
                f"Veículo inadequado: precisa conter "
                f"'{veiculo_necessario}', tipo cadastrado: "
                f"'{veiculo.get('tipo')}'",
                detalhes,
            )

    categoria_necessaria = req.get("equipamento_categoria")

    if categoria_necessaria:
        categorias = [
            equipamento.get("categoria")
            for equipamento in equipamentos_eq
            if equipamento.get("status") in (None, "operacional", "disponivel")
        ]

        if categoria_necessaria not in categorias:
            detalhes["equipamento_ok"] = False

            return (
                False,
                f"Falta equipamento da categoria {categoria_necessaria}",
                detalhes,
            )

    return True, None, detalhes


# ============================================================
# PONTUAÇÃO
# ============================================================

def _pontuar(
    elegivel: bool,
    distancia_m: float,
    esp_match: bool,
    hab_match: bool,
    eqp_match: bool,
    mesma_regiao: bool,
) -> float:
    """Retorna score entre 0 e 1."""

    if not elegivel:
        return 0.0

    proximidade = max(0.0, 1.0 - distancia_m / 50_000)

    score = (
        0.40 * proximidade
        + 0.20 * (1.0 if esp_match else 0.4)
        + 0.15 * (1.0 if hab_match else 0.5)
        + 0.15 * (1.0 if eqp_match else 0.5)
        + 0.10 * (1.0 if mesma_regiao else 0.0)
    )

    return round(score, 3)


# ============================================================
# CRIAÇÃO DA OFERTA DE DESPACHO
# ============================================================

def _criar_oferta(ocorrencia_id: str, top: dict) -> dict:
    """
    Cria uma oferta para a equipe selecionada.

    Não duplica uma oferta pendente ou um despacho já aceito
    para a mesma ocorrência.
    """

    existentes = (
        sb()
        .table("despachos_ocorrencias")
        .select("id, equipe_id, status")
        .eq("ocorrencia_id", ocorrencia_id)
        .in_("status", ["ofertada", "aceita"])
        .limit(1)
        .execute()
        .data
        or []
    )

    if existentes:
        existente = existentes[0]

        return {
            "criado": False,
            "motivo": "ja_existe_despacho_ativo",
            "despacho_id": existente["id"],
            "equipe_id": existente["equipe_id"],
            "status": existente["status"],
        }

    agora = datetime.now(timezone.utc)
    expiracao = agora + timedelta(minutes=10)

    registro = {
        "ocorrencia_id": ocorrencia_id,
        "equipe_id": top["equipe_id"],
        "posicao": 1,
        "pontuacao": round(top["pontuacao"] * 100, 1),
        "distancia_km": top["distancia_km"],
        "eta_minutos": top["eta_minutos"],
        "enviado_em": agora.isoformat(),
        "expira_em": expiracao.isoformat(),
        "status": "ofertada",
        "motivo": (
            f'{top["equipe_nome"]} selecionada pela IA'
        ),
        "detalhes": {
            "origem": "despacho_automatico",
            "pontuacao_original": top["pontuacao"],
            "distancia_m": top["distancia_m"],
            "elegivel": top["elegivel"],
            "criterio": "melhor equipe elegível",
        },
    }

    resultado = (
        sb()
        .table("despachos_ocorrencias")
        .insert(registro)
        .execute()
    )

    linhas = resultado.data or []

    if not linhas:
        # O cliente Supabase normalmente devolve a linha inserida.
        # Se não devolver, verificamos se a oferta foi persistida.
        verificacao = (
            sb()
            .table("despachos_ocorrencias")
            .select("id, equipe_id, status")
            .eq("ocorrencia_id", ocorrencia_id)
            .eq("equipe_id", top["equipe_id"])
            .eq("status", "ofertada")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )

        if not verificacao:
            raise RuntimeError(
                "O Supabase não confirmou a criação do despacho."
            )

        linhas = verificacao

    return {
        "criado": True,
        "motivo": "oferta_criada",
        "despacho_id": linhas[0].get("id"),
        "equipe_id": top["equipe_id"],
        "status": "ofertada",
    }


# ============================================================
# PROCESSAMENTO PRINCIPAL
# ============================================================

def processar(ocorrencia_id: str) -> dict:
    """Calcula ranking, atualiza recomendação e cria a oferta."""

    ocorrencias = (
        sb()
        .table("ocorrencias")
        .select("*")
        .eq("id", ocorrencia_id)
        .limit(1)
        .execute()
        .data
        or []
    )

    if not ocorrencias:
        return {
            "erro": "nao_encontrada",
            "ocorrencia_id": ocorrencia_id,
        }

    oc = ocorrencias[0]

    if oc.get("latitude") is None or oc.get("longitude") is None:
        return {
            "erro": "coordenadas_ausentes",
            "ocorrencia_id": ocorrencia_id,
        }

    tipo = oc.get("tipo") or "outro"
    requisitos = REQUISITOS.get(tipo, REQUISITOS_PADRAO)

    # 1. Equipes disponíveis.
    equipes = (
        sb()
        .table("equipes")
        .select("*")
        .eq("status", "disponivel")
        .execute()
        .data
        or []
    )

    if not equipes:
        (
            sb()
            .table("ia_recomendacoes_equipes")
            .delete()
            .eq("ocorrencia_id", ocorrencia_id)
            .execute()
        )

        return {
            "ocorrencia_id": ocorrencia_id,
            "tipo": tipo,
            "top": None,
            "total_avaliadas": 0,
            "elegiveis": 0,
            "inelegiveis": 0,
            "despacho_criado": False,
            "motivo": "Sem equipes disponíveis",
        }

    equipe_ids = [equipe["id"] for equipe in equipes]

    # 2. Dados auxiliares.
    dados = _buscar_dados_equipes(equipe_ids)

    # 3. Última localização conhecida de cada equipe.
    localizacoes = (
        sb()
        .table("localizacoes_equipes")
        .select("*")
        .in_("equipe_id", equipe_ids)
        .order("data_hora", desc=True)
        .execute()
        .data
        or []
    )

    ultima_localizacao = {}

    for localizacao in localizacoes:
        ultima_localizacao.setdefault(
            localizacao["equipe_id"],
            localizacao,
        )

    # 4. Bases operacionais.
    bases = (
        sb()
        .table("bases_operacionais")
        .select("*")
        .execute()
        .data
        or []
    )

    base_por_id = {
        base["id"]: base
        for base in bases
    }

    # 5. Veículos.
    veiculos = (
        sb()
        .table("veiculos")
        .select("*")
        .execute()
        .data
        or []
    )

    veiculo_por_id = {
        veiculo["id"]: veiculo
        for veiculo in veiculos
    }

    # 6. Avaliar cada equipe.
    ranking = []

    for equipe in equipes:
        equipe_id = equipe["id"]

        localizacao = ultima_localizacao.get(equipe_id)

        if localizacao:
            distancia = haversine_m(
                oc["latitude"],
                oc["longitude"],
                localizacao["latitude"],
                localizacao["longitude"],
            )
        else:
            base = base_por_id.get(
                equipe.get("base_operacional_id")
            )

            if (
                base
                and base.get("latitude") is not None
                and base.get("longitude") is not None
            ):
                distancia = haversine_m(
                    oc["latitude"],
                    oc["longitude"],
                    base["latitude"],
                    base["longitude"],
                )
            else:
                distancia = 999_000

        especialidades = dados["especialidades"].get(
            equipe_id, set()
        )

        equipamentos = dados["equipamentos"].get(
            equipe_id, []
        )

        tecnicos = dados["tecnicos"].get(
            equipe_id, []
        )

        habilitacoes = dados["habilitacoes"]

        veiculo = veiculo_por_id.get(
            equipe.get("veiculo_id")
        )

        elegivel, motivo, detalhes = _avaliar_elegibilidade(
            equipe,
            requisitos,
            especialidades,
            equipamentos,
            tecnicos,
            habilitacoes,
            veiculo,
        )

        especialidades_necessarias = (
            requisitos.get("especialidades") or []
        )

        habilitacoes_necessarias = (
            requisitos.get("habilitacoes") or []
        )

        categoria_necessaria = requisitos.get(
            "equipamento_categoria"
        )

        esp_match = (
            bool(set(especialidades_necessarias) & especialidades)
            if especialidades_necessarias
            else True
        )

        if habilitacoes_necessarias:
            hab_match = any(
                set(habilitacoes_necessarias)
                & habilitacoes.get(tecnico_id, set())
                for tecnico_id in tecnicos
            )
        else:
            hab_match = True

        if categoria_necessaria:
            eqp_match = any(
                equipamento.get("categoria") == categoria_necessaria
                and equipamento.get("status")
                in (None, "operacional", "disponivel")
                for equipamento in equipamentos
            )
        else:
            eqp_match = True

        mesma_regiao = (
            equipe.get("regiao_id") == oc.get("regiao_id")
        )

        pontuacao = _pontuar(
            elegivel,
            distancia,
            esp_match,
            hab_match,
            eqp_match,
            mesma_regiao,
        )

        eta = (
            int(distancia / 1000 / 40 * 60)
            if distancia < 900_000
            else None
        )

        ranking.append({
            "equipe_id": equipe_id,
            "equipe_nome": equipe["nome"],
            "elegivel": elegivel,
            "motivo_inelegibilidade": motivo,
            "distancia_m": round(distancia, 2),
            "distancia_km": round(distancia / 1000, 2),
            "eta_minutos": eta,
            "pontuacao": pontuacao,
            "detalhes": detalhes,
        })

    # 7. Elegíveis primeiro; dentro delas, maior pontuação primeiro.
    elegiveis = [
        item for item in ranking
        if item["elegivel"]
    ]

    inelegiveis = [
        item for item in ranking
        if not item["elegivel"]
    ]

    elegiveis.sort(
        key=lambda item: item["pontuacao"],
        reverse=True,
    )

    inelegiveis.sort(
        key=lambda item: item["distancia_m"]
    )

    ranking_final = elegiveis + inelegiveis

    # 8. Atualizar ranking da IA.
    (
        sb()
        .table("ia_recomendacoes_equipes")
        .delete()
        .eq("ocorrencia_id", ocorrencia_id)
        .execute()
    )

    for posicao, item in enumerate(ranking_final[:15], start=1):
        (
            sb()
            .table("ia_recomendacoes_equipes")
            .insert({
                "ocorrencia_id": ocorrencia_id,
                "equipe_id": item["equipe_id"],
                "elegivel": item["elegivel"],
                "motivo_inelegibilidade": (
                    item["motivo_inelegibilidade"]
                ),
                "distancia_km": item["distancia_km"],
                "eta_minutos": item["eta_minutos"],
                "pontuacao": item["pontuacao"],
                "posicao": posicao,
                "detalhes": {
                    **item["detalhes"],
                    "equipe_nome": item["equipe_nome"],
                    "motivo_regra": requisitos.get("descricao"),
                },
            })
            .execute()
        )

    # 9. Selecionar a melhor equipe elegível.
    top = elegiveis[0] if elegiveis else None
    resultado_despacho = {
        "criado": False,
        "motivo": "nenhuma_equipe_elegivel",
    }

    if top:
        # Persistir recomendação na ocorrência.
        (
            sb()
            .table("ocorrencias")
            .update({
                "ia_equipe_recomendada_id": top["equipe_id"],
            })
            .eq("id", ocorrencia_id)
            .execute()
        )

        # Criar oferta que o aplicativo de campo consulta.
        resultado_despacho = _criar_oferta(
            ocorrencia_id,
            top,
        )

    return {
        "ocorrencia_id": ocorrencia_id,
        "tipo": tipo,
        "requisitos": requisitos.get("descricao"),
        "top": top,
        "total_avaliadas": len(ranking_final),
        "elegiveis": len(elegiveis),
        "inelegiveis": len(inelegiveis),
        "despacho_criado": resultado_despacho["criado"],
        "despacho": resultado_despacho,
    }