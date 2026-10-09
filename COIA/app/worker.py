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


def chamados_sem_ocorrencia(minutos: int = 60):
    desde = (datetime.now(timezone.utc) - timedelta(minutes=minutos)).isoformat()
    resp = (sb().table("chamados").select("id, protocolo")
              .is_("ocorrencia_id", "null")
              .gte("data_hora", desde)
              .order("data_hora", desc=False)
              .execute())
    return resp.data or []


def ocorrencias_sem_evento(minutos: int = 60):
    """Ocorrências recentes que ainda não foram agrupadas em evento."""
    desde = (datetime.now(timezone.utc) - timedelta(minutes=minutos)).isoformat()
    resp = (sb().table("ocorrencias").select("id, protocolo")
              .is_("evento_id", "null")
              .gte("data_hora_criacao", desde)
              .order("data_hora_criacao", desc=False)
              .execute())
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
                log.info(f"COIA processou ocorrência {oid}")
        except Exception as e:
            log.exception(f"Erro no chamado {c['id']}: {e}")

    return processadas


def processar_eventos():
    """Varre ocorrências sem evento e tenta agrupar."""
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
                    f"COIA {acao} — evento {r.get('codigo')} "
                    f"({r.get('total_ocorrencias')} ocorrências)"
                )
        except Exception as e:
            log.exception(f"Erro ao agrupar evento da ocorrência {oc['id']}: {e}")


def rodar():
    try:
        processar_chamados()
    except Exception as e:
        log.exception(f"Erro no processamento de chamados: {e}")

    try:
        processar_eventos()
    except Exception as e:
        log.exception(f"Erro no processamento de eventos: {e}")


def main():
    log.info("COIA V.1 — worker iniciado")
    while True:
        try:
            rodar()
        except Exception as e:
            log.exception(f"Erro na volta: {e}")
        time.sleep(settings.loop_interval_seconds)


if __name__ == "__main__":
    main()