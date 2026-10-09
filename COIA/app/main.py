from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.modulos import correlacao, prioridade, despacho, previsao

app = FastAPI(
    title="COIA V.1 — CEMIG Operational Intelligence Assistant",
    description="Motor de inteligência da operação",
    version="1.0.0",
)

class ChamadoReq(BaseModel):
    chamado_id: str

@app.get("/health")
def health():
    return {
        "ok": True,
        "servico": "COIA V.1",
        "hora": datetime.now(timezone.utc).isoformat(),
    }

@app.post("/correlacionar")
def correlacionar(req: ChamadoReq):
    try:
        return correlacao.processar_chamado(req.chamado_id)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/priorizar/{ocorrencia_id}")
def priorizar(ocorrencia_id: str):
    return prioridade.processar(ocorrencia_id)

@app.post("/despachar/{ocorrencia_id}")
def despachar(ocorrencia_id: str):
    return despacho.processar(ocorrencia_id)

@app.post("/prever/{ocorrencia_id}")
def prever(ocorrencia_id: str):
    return previsao.processar(ocorrencia_id)

@app.post("/processar-completo/{chamado_id}")
def processar_completo(chamado_id: str):
    r1 = correlacao.processar_chamado(chamado_id)
    oid = r1.get("ocorrencia_id")
    if not oid:
        return {"etapas": [r1]}
    return {
        "ocorrencia_id": oid,
        "etapas": [
            r1,
            prioridade.processar(oid),
            despacho.processar(oid),
            previsao.processar(oid),
        ],
    }