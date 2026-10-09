/*
# COIA V.1 — Monitor do Motor: Create all monitoring tables

This migration creates the 9 tables that the AI engine monitor reads in real time.

## Tables Created

1. `chamados` — Incoming service tickets (calls/tickets)
   - id, protocolo, tipo, ocorrencia_id, data_hora

2. `ocorrencias` — Incidents/outages linked to tickets
   - id, protocolo, ia_prioridade_final, ia_previsao_restabelecimento, ia_confianca, ia_atualizado_em

3. `ia_correlacoes` — AI correlation between tickets and occurrences
   - id, ocorrencia_id, chamado_id, distancia_m, score, motivo, criado_em

4. `ia_prioridades` — AI priority decisions
   - id, ocorrencia_id, prioridade_final, motivo, criado_em

5. `ia_recomendacoes_equipes` — AI team dispatch recommendations
   - id, ocorrencia_id, equipe_id, distancia_km, eta_minutos, pontuacao, posicao, criado_em

6. `ia_previsoes` — AI restoration time predictions
   - id, ocorrencia_id, tipo, tempo_estimado_min, horario_estimado, confianca, modelo_versao, criado_em

7. `ia_analises` — AI analysis records
   - id, entidade, entidade_id, tipo_analise, resultado, confianca, justificativa, modelo_versao, criado_em

8. `historico_operacional` — Operational history/audit log
   - id, entidade, entidade_id, acao, usuario, resultado, observacoes, criado_em

9. `atendimentos` — Service/attendance records for incidents
   - id, ocorrencia_id, equipe_id, status, data_hora_aceite, data_hora_restabelecimento

## Security
- RLS enabled on all tables.
- This is a no-auth read-only monitoring app — all tables allow anon + authenticated SELECT only (no writes from the frontend).
- INSERT/UPDATE/DELETE policies are NOT created because the app is read-only and data is populated by the backend engine.
*/

-- 1. chamados
CREATE TABLE IF NOT EXISTS chamados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text,
  tipo text,
  ocorrencia_id uuid,
  data_hora timestamptz DEFAULT now()
);
ALTER TABLE chamados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_chamados" ON chamados;
CREATE POLICY "anon_select_chamados" ON chamados FOR SELECT TO anon, authenticated USING (true);

-- 2. ocorrencias
CREATE TABLE IF NOT EXISTS ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text,
  ia_prioridade_final text,
  ia_previsao_restabelecimento timestamptz,
  ia_confianca numeric,
  ia_atualizado_em timestamptz DEFAULT now()
);
ALTER TABLE ocorrencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ocorrencias" ON ocorrencias;
CREATE POLICY "anon_select_ocorrencias" ON ocorrencias FOR SELECT TO anon, authenticated USING (true);

-- 3. ia_correlacoes
CREATE TABLE IF NOT EXISTS ia_correlacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid,
  chamado_id uuid,
  distancia_m numeric,
  score numeric,
  motivo text,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE ia_correlacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ia_correlacoes" ON ia_correlacoes;
CREATE POLICY "anon_select_ia_correlacoes" ON ia_correlacoes FOR SELECT TO anon, authenticated USING (true);

-- 4. ia_prioridades
CREATE TABLE IF NOT EXISTS ia_prioridades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid,
  prioridade_final text,
  motivo text,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE ia_prioridades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ia_prioridades" ON ia_prioridades;
CREATE POLICY "anon_select_ia_prioridades" ON ia_prioridades FOR SELECT TO anon, authenticated USING (true);

-- 5. ia_recomendacoes_equipes
CREATE TABLE IF NOT EXISTS ia_recomendacoes_equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid,
  equipe_id text,
  distancia_km numeric,
  eta_minutos integer,
  pontuacao numeric,
  posicao integer,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE ia_recomendacoes_equipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ia_recomendacoes_equipes" ON ia_recomendacoes_equipes;
CREATE POLICY "anon_select_ia_recomendacoes_equipes" ON ia_recomendacoes_equipes FOR SELECT TO anon, authenticated USING (true);

-- 6. ia_previsoes
CREATE TABLE IF NOT EXISTS ia_previsoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid,
  tipo text,
  tempo_estimado_min integer,
  horario_estimado timestamptz,
  confianca numeric,
  modelo_versao text,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE ia_previsoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ia_previsoes" ON ia_previsoes;
CREATE POLICY "anon_select_ia_previsoes" ON ia_previsoes FOR SELECT TO anon, authenticated USING (true);

-- 7. ia_analises
CREATE TABLE IF NOT EXISTS ia_analises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text,
  entidade_id uuid,
  tipo_analise text,
  resultado text,
  confianca numeric,
  justificativa text,
  modelo_versao text,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE ia_analises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ia_analises" ON ia_analises;
CREATE POLICY "anon_select_ia_analises" ON ia_analises FOR SELECT TO anon, authenticated USING (true);

-- 8. historico_operacional
CREATE TABLE IF NOT EXISTS historico_operacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text,
  entidade_id uuid,
  acao text,
  usuario text,
  resultado text,
  observacoes text,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE historico_operacional ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_historico_operacional" ON historico_operacional;
CREATE POLICY "anon_select_historico_operacional" ON historico_operacional FOR SELECT TO anon, authenticated USING (true);

-- 9. atendimentos
CREATE TABLE IF NOT EXISTS atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid,
  equipe_id text,
  status text,
  data_hora_aceite timestamptz,
  data_hora_restabelecimento timestamptz
);
ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_atendimentos" ON atendimentos;
CREATE POLICY "anon_select_atendimentos" ON atendimentos FOR SELECT TO anon, authenticated USING (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chamados_ocorrencia ON chamados(ocorrencia_id);
CREATE INDEX IF NOT EXISTS idx_chamados_data ON chamados(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_correlacoes_ocorrencia ON ia_correlacoes(ocorrencia_id);
CREATE INDEX IF NOT EXISTS idx_correlacoes_criado ON ia_correlacoes(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_prioridades_ocorrencia ON ia_prioridades(ocorrencia_id);
CREATE INDEX IF NOT EXISTS idx_prioridades_criado ON ia_prioridades(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_recomendacoes_ocorrencia ON ia_recomendacoes_equipes(ocorrencia_id);
CREATE INDEX IF NOT EXISTS idx_recomendacoes_criado ON ia_recomendacoes_equipes(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_previsoes_ocorrencia ON ia_previsoes(ocorrencia_id);
CREATE INDEX IF NOT EXISTS idx_previsoes_criado ON ia_previsoes(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_analises_confianca ON ia_analises(confianca);
CREATE INDEX IF NOT EXISTS idx_analises_criado ON ia_analises(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_historico_resultado ON historico_operacional(resultado);
CREATE INDEX IF NOT EXISTS idx_historico_criado ON historico_operacional(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_atendimentos_ocorrencia ON atendimentos(ocorrencia_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_restabelecimento ON atendimentos(data_hora_restabelecimento);

-- Enable realtime for all tables
ALTER TABLE chamados REPLICA IDENTITY FULL;
ALTER TABLE ocorrencias REPLICA IDENTITY FULL;
ALTER TABLE ia_correlacoes REPLICA IDENTITY FULL;
ALTER TABLE ia_prioridades REPLICA IDENTITY FULL;
ALTER TABLE ia_recomendacoes_equipes REPLICA IDENTITY FULL;
ALTER TABLE ia_previsoes REPLICA IDENTITY FULL;
ALTER TABLE ia_analises REPLICA IDENTITY FULL;
ALTER TABLE historico_operacional REPLICA IDENTITY FULL;
ALTER TABLE atendimentos REPLICA IDENTITY FULL;
