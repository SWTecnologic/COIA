from datetime import datetime, timedelta, timezone
from app.db import sb

TEMPO_BASE_MIN = {
    "sem_energia": 45,
    "cabo_rompido": 90,
    "cabo_no_chao": 75,
    "poste_danificado": 120,
    "transformador": 150,
    "curto_circuito": 60,
    "falha_equipamento": 90,
    "arvore_sobre_rede": 80,
    "oscilacao": 40,
}

def processar(ocorrencia_id: str) -> dict:
    oc = (sb().table("ocorrencias").select("*").eq("id", ocorrencia_id)
            .single().execute()).data
    if not oc:
        return {"erro": "nao_encontrada"}

    base = TEMPO_BASE_MIN.get(oc.get("tipo") or "outro", 60)

    rec = (sb().table("ia_recomendacoes_equipes").select("*")
             .eq("ocorrencia_id", ocorrencia_id).eq("posicao", 1)
             .limit(1).execute()).data
    eta = (rec[0].get("eta_minutos") if rec else None) or 15

    desloc = eta
    reparo = base
    teste = max(5, int(base * 0.15))
    religacao = 5
    total = desloc + reparo + teste + religacao

    agora = datetime.now(timezone.utc)
    previsto = agora + timedelta(minutes=total)
    margem = max(5, int(total * 0.15))
    inferior = previsto - timedelta(minutes=margem)
    superior = previsto + timedelta(minutes=margem)

    sb().table("ia_previsoes").insert({
        "ocorrencia_id": ocorrencia_id,
        "tipo": "restabelecimento_total",
        "tempo_estimado_min": total,
        "horario_estimado": previsto.isoformat(),
        "limite_inferior": inferior.isoformat(),
        "limite_superior": superior.isoformat(),
        "confianca": 0.75,
        "motivo_atualizacao": "cálculo inicial COIA v1",
    }).execute()

    sb().table("ocorrencias").update({
        "ia_previsao_restabelecimento": previsto.isoformat(),
        "ia_confianca": 0.75,
    }).eq("id", ocorrencia_id).execute()

    return {
        "ocorrencia_id": ocorrencia_id,
        "deslocamento_min": desloc,
        "reparo_min": reparo,
        "teste_min": teste,
        "religacao_min": religacao,
        "total_min": total,
        "previsao": previsto.isoformat(),
        "confianca": 0.75,
    }