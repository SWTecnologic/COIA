# COIA V.1 — CEMIG Operational Intelligence Assistant

Motor de inteligência da operação. Lê dados do Supabase,
processa (correlação, priorização, despacho, previsão) e
devolve os resultados em tabelas `ia_*` + colunas de atalho.

## Instalação

```bash
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edita o .env com URL e SERVICE_ROLE key