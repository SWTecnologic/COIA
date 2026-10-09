from datetime import datetime, timezone
from app.db import sb
from app.modulos.correlacao import haversine_m

LIM_URGENTE = 100
LIM_PRIORIDADE = 20
RAIO_CRITICO_KM = 2.0

def processar(ocorrencia_id: str) -> dict:
    oc = (sb().table("ocorrencias").select("*").eq("id", ocorrencia_id)
            .single().execute()).data
    if not oc:
        return {"erro": "nao_encontrada"}

    consumidores = oc.get("consumidores_afetados") or 0
    risco = oc.get("risco_informado") or "baixo"

    pontos = (sb().table("pontos_criticos")
                .select("nome, nivel_criticidade, latitude, longitude")
                .eq("ativo", True).execute()).data or []

    criticos_perto = [
        p for p in pontos
        if haversine_m(oc["latitude"], oc["longitude"],
                       p["latitude"], p["longitude"]) <= RAIO_CRITICO_KM * 1000
    ]
    tem_critico_alto = any(p["nivel_criticidade"] == "alto" for p in criticos_perto)

    if consumidores >= LIM_URGENTE or risco == "alto" or tem_critico_alto:
        prioridade = "urgente"
        motivo = (f"{consumidores} consumidores; risco={risco}; "
                  f"{len(criticos_perto)} ponto(s) crítico(s) num raio de "
                  f"{RAIO_CRITICO_KM}km")
    elif consumidores >= LIM_PRIORIDADE:
        prioridade = "prioridade"
        motivo = f"{consumidores} consumidores afetados"
    else:
        prioridade = "ordem_chamada"
        motivo = "Baixo impacto imediato"

    sb().table("ia_prioridades").insert({
        "ocorrencia_id": ocorrencia_id,
        "prioridade_sugerida": prioridade,
        "prioridade_final": prioridade,
        "score": min(consumidores / LIM_URGENTE, 1.0),
        "motivo": motivo,
    }).execute()

    sb().table("ocorrencias").update({
        "ia_prioridade_final": prioridade,
        "ia_atualizado_em": datetime.now(timezone.utc).isoformat(),
    }).eq("id", ocorrencia_id).execute()

    return {
        "ocorrencia_id": ocorrencia_id,
        "prioridade": prioridade,
        "motivo": motivo,
    }