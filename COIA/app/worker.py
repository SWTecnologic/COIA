import logging
import time
from datetime import datetime, timedelta, timezone

from app.db import sb
from app.config import settings
from app.modulos import correlacao, prioridade, despacho, previsao, eventos

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)s] [COIA] %(message)s",
)
log = logging.getLogger("coia.worker")


# ============================================================
# CHAMADOS (fluxo original — porta de entrada)
# ============================================================

def chamados_sem_ocorrencia(minutos: int = 60):
    desde = (datetime.now(timezone.utc) - timedelta(minutes=minutos)).isoformat()
    resp = (
        sb().table("chamados").select("id, protocolo")
        .is_("ocorrencia_id", "null")
        .gte("data_hora", desde)
        .order("data_hora", desc=False)
        .execute()
    )
    return resp.data or []


def processar_chamados():
    chamados = chamados_sem_ocorrencia()
    log.info(f"[chamados] {len(chamados)} chamado(s) sem ocorrência")
    processadas = set()

    for c in chamados:
        try:
            r = correlacao.processar_chamado(c["id"])
            oid = r.get("ocorrencia_id")
            if oid and oid not in processadas:
                prioridade.processar(oid)
                despacho.processar(oid)
                previsao.processar(oid)
                processadas.add(oid)
                log.info(f"[chamados] ✅ ocorrência {oid} processada")
        except Exception as e:
            log.exception(f"[chamados] ❌ Erro no chamado {c['id']}: {e}")

    return processadas


# ============================================================
# 🆕 OCORRÊNCIAS ÓRFÃS (criadas direto no banco, sem chamado)
# ============================================================

def ocorrencias_sem_despacho(minutos: int = 1440):
    """
    Ocorrências em status inicial que NÃO têm nenhum despacho vivo
    (ofertada/aceita). Varre por padrão as últimas 24h.
    """
    desde = (
        datetime.now(timezone.utc) - timedelta(minutes=minutos)
    ).isoformat()

    resp = (
        sb()
        .table("ocorrencias")
        .select("id, protocolo, status")
        .in_("status", [
            "nova",
            "registrada",
            "em_analise",
            "aguardando_equipe",
        ])
        .gte("data_hora_criacao", desde)
        .order("data_hora_criacao", desc=False)
        .execute()
    )

    ocorrencias = resp.data or []
    orfas = []

    for oc in ocorrencias:
        despachos = (
            sb()
            .table("despachos_ocorrencias")
            .select("id")
            .eq("ocorrencia_id", oc["id"])
            .in_("status", ["ofertada", "aceita"])
            .limit(1)
            .execute()
            .data
            or []
        )
        if not despachos:
            orfas.append(oc)

    return orfas


def processar_ocorrencias_orfas():
    """
    Varre ocorrências sem despacho e roda:
    prioridade → despacho → previsão.
    Resultado: cria oferta em despachos_ocorrencias pra melhor equipe.
    """
    orfas = ocorrencias_sem_despacho()
    if not orfas:
        return

    log.info(f"[orfas] {len(orfas)} ocorrência(s) sem despacho")

    for oc in orfas:
        oid = oc["id"]
        proto = oc.get("protocolo", oid)
        try:
            prioridade.processar(oid)
            resultado = despacho.processar(oid)
            previsao.processar(oid)

            criado = resultado.get("despacho_criado")
            if criado:
                equipe = resultado.get("top", {}).get("equipe_nome")
                dist = resultado.get("top", {}).get("distancia_km")
                log.info(
                    f"[orfas] ✅ {proto} → {equipe} "
                    f"({dist} km)"
                )
            else:
                motivo = resultado.get("despacho", {}).get("motivo") \
                    or resultado.get("motivo") \
                    or "sem equipe elegível"
                log.info(f"[orfas] ⏭  {proto} — {motivo}")
        except Exception as e:
            log.exception(f"[orfas] ❌ Erro em {proto}: {e}")


# ============================================================
# EXPIRAÇÃO (limpa ofertas vencidas)
# ============================================================

def expirar_despachos_vencidos():
    """Marca como expirada qualquer oferta passada do prazo."""
    agora = datetime.now(timezone.utc).isoformat()
    resp = (
        sb()
        .table("despachos_ocorrencias")
        .update({"status": "expirada", "respondido_em": agora})
        .eq("status", "ofertada")
        .lt("expira_em", agora)
        .execute()
    )
    return len(resp.data or [])


# ============================================================
# EVENTOS (agrupamento)
# ============================================================

def ocorrencias_sem_evento(minutos: int = 60):
    desde = (datetime.now(timezone.utc) - timedelta(minutes=minutos)).isoformat()
    resp = (
        sb().table("ocorrencias").select("id, protocolo")
        .is_("evento_id", "null")
        .gte("data_hora_criacao", desde)
        .order("data_hora_criacao", desc=False)
        .execute()
    )
    return resp.data or []


def processar_eventos():
    ocs = ocorrencias_sem_evento()
    if not ocs:
        return

    log.info(f"[eventos] {len(ocs)} ocorrência(s) sem evento")
    for oc in ocs:
        try:
            r = eventos.processar_ocorrencia(oc["id"])
            acao = r.get("acao")
            if acao in ("evento_criado", "evento_reutilizado"):
                log.info(
                    f"[eventos] {acao} — {r.get('codigo')} "
                    f"({r.get('total_ocorrencias')} ocorrências)"
                )
        except Exception as e:
            log.exception(f"[eventos] Erro em {oc['id']}: {e}")


# ============================================================
# LOOP PRINCIPAL
# ============================================================

def rodar():
    # 1. Chamados → cria ocorrências e despacha
    try:
        processar_chamados()
    except Exception as e:
        log.exception(f"Erro em chamados: {e}")

    # 2. 🆕 Órfãs → despacha ocorrências criadas direto no banco
    try:
        processar_ocorrencias_orfas()
    except Exception as e:
        log.exception(f"Erro em órfãs: {e}")

    # 3. Expira ofertas vencidas (pra re-despachar no próximo ciclo)
    try:
        qtd = expirar_despachos_vencidos()
        if qtd:
            log.info(f"[expiração] {qtd} oferta(s) expirada(s)")
    except Exception as e:
        log.exception(f"Erro em expiração: {e}")

    # 4. Agrupa eventos
    try:
        processar_eventos()
    except Exception as e:
        log.exception(f"Erro em eventos: {e}")


def main():
    log.info("COIA V.1 — worker iniciado")
    log.info(f"Loop a cada {settings.loop_interval_seconds}s")
    while True:
        try:
            rodar()
        except Exception as e:
            log.exception(f"Erro na volta: {e}")
        time.sleep(settings.loop_interval_seconds)


if __name__ == "__main__":
    main()