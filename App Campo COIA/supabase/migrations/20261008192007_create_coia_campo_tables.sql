/*
# COIA Campo - Create all database tables

## Overview
This migration creates the complete schema for the COIA Campo app — a field technician
app for an energy distribution company. Technicians receive occurrence dispatches
(power outages, cable breaks, etc.) and track their field service workflow.

## New Tables (11 total)

1. **usuarios_sistema** — System users (technicians/managers). Links to auth.users
   via auth_user_id. Each technician belongs to one equipe.
2. **equipes** — Teams of technicians. Has a vehicle, region, operational radius.
3. **veiculos** — Vehicles assigned to teams.
4. **ocorrencias** — Power occurrences (outages, cable breaks). Has protocol number,
   location, priority, AI-prioritization fields, affected consumers count.
5. **despachos_ocorrencias** — Dispatch assignments linking occurrences to teams.
   Has position/score/distance/ETA for prioritization.
6. **atendimentos** — Service records tracking every timestamp of the field workflow
   (acceptance, departure, arrival, diagnosis, repair, testing, reconnection, closure).
7. **diagnosticos** — Diagnosis records per occurrence (problem type, severity, materials).
8. **testes** — Test records per occurrence (test type, result).
9. **localizacoes_equipes** — GPS tracking entries (INSERT per reading, not update).
10. **pausas_equipes** — Break records (coffee, lunch, rest) with planned/actual times.
11. **pontos_criticos** — Critical infrastructure points (hospitals, substations) shown on map.

## Security
- RLS enabled on all tables.
- All policies scoped TO authenticated (app has sign-in).
- usuarios_sistema: owner-scoped via auth_user_id = auth.uid().
- equipes: technicians can read/update their own team.
- veiculos: technicians can read their own team's vehicle.
- ocorrencias: technicians can read/update occurrences dispatched to their team.
- despachos_ocorrencias: technicians can read/insert/update dispatches for their team.
- atendimentos: technicians can read/insert/update attendances for their team.
- diagnosticos: technicians can insert/read for their team's occurrences.
- testes: technicians can insert/read for their team's occurrences.
- localizacoes_equipes: technicians can insert/read/update for their own team.
- pausas_equipes: technicians can insert/read/update for their own team.
- pontos_criticos: readable by all authenticated users (reference data).
*/

-- ============================================================
-- Create all tables first (no policies yet)
-- ============================================================

-- 1. veiculos (no dependencies)
CREATE TABLE IF NOT EXISTS veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  tipo text CHECK (tipo IN ('caminhao', 'pickup', 'moto', 'van')),
  modelo text,
  placa text UNIQUE,
  capacidade text,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em_uso', 'manutencao')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. equipes (depends on veiculos)
CREATE TABLE IF NOT EXISTS equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em_deslocamento', 'no_local', 'em_pausa', 'indisponivel')),
  regiao_id uuid,
  base_operacional_id uuid,
  veiculo_id uuid REFERENCES veiculos(id) ON DELETE SET NULL,
  qtd_tecnicos int NOT NULL DEFAULT 1,
  turno text CHECK (turno IN ('diurno', 'noturno')),
  raio_operacional_km numeric DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. usuarios_sistema (depends on equipes + auth.users)
CREATE TABLE IF NOT EXISTS usuarios_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_usuario text NOT NULL DEFAULT 'tecnico' CHECK (tipo_usuario IN ('tecnico', 'gerente')),
  equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL,
  nome text NOT NULL,
  login text UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. ocorrencias (no FK dependencies on other new tables)
CREATE TABLE IF NOT EXISTS ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text UNIQUE NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('sem_energia', 'cabo_rompido', 'curto_circuito', 'sobrecarga', 'manutencao_preventiva', 'religacao', 'outro')),
  descricao text,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  status text NOT NULL DEFAULT 'nova' CHECK (status IN ('nova', 'em_analise', 'equipe_em_deslocamento', 'equipe_no_local', 'diagnostico', 'em_reparo', 'em_teste', 'aguardando_religacao', 'restabelecida', 'cancelada')),
  prioridade text NOT NULL DEFAULT 'ordem_chamada' CHECK (prioridade IN ('urgente', 'prioridade', 'ordem_chamada')),
  consumidores_afetados int DEFAULT 0,
  ia_prioridade_final text,
  ia_previsao_restabelecimento timestamptz,
  data_hora_criacao timestamptz DEFAULT now(),
  data_hora_encerramento timestamptz,
  evento_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. despachos_ocorrencias (depends on ocorrencias + equipes)
CREATE TABLE IF NOT EXISTS despachos_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  equipe_id uuid NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  posicao int,
  pontuacao numeric,
  distancia_km numeric,
  eta_minutos int,
  enviado_em timestamptz DEFAULT now(),
  respondido_em timestamptz,
  status text NOT NULL DEFAULT 'ofertada' CHECK (status IN ('ofertada', 'aceita', 'recusada', 'expirada')),
  motivo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. atendimentos (depends on ocorrencias + equipes)
CREATE TABLE IF NOT EXISTS atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  equipe_id uuid NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  data_hora_aceite timestamptz,
  data_hora_saida timestamptz,
  data_hora_chegada timestamptz,
  data_hora_inicio_diagnostico timestamptz,
  data_hora_fim_diagnostico timestamptz,
  data_hora_inicio_reparo timestamptz,
  data_hora_fim_reparo timestamptz,
  data_hora_inicio_teste timestamptz,
  data_hora_fim_teste timestamptz,
  data_hora_religacao timestamptz,
  data_hora_restabelecimento timestamptz,
  data_hora_encerramento timestamptz,
  observacoes text,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido', 'cancelado')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. diagnosticos (depends on ocorrencias + atendimentos)
CREATE TABLE IF NOT EXISTS diagnosticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  atendimento_id uuid REFERENCES atendimentos(id) ON DELETE CASCADE,
  tipo_problema text,
  descricao text,
  gravidade text CHECK (gravidade IN ('baixa', 'media', 'alta', 'critica')),
  servico_necessario text,
  material_necessario text,
  created_at timestamptz DEFAULT now()
);

-- 8. testes (depends on ocorrencias + atendimentos)
CREATE TABLE IF NOT EXISTS testes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  atendimento_id uuid REFERENCES atendimentos(id) ON DELETE CASCADE,
  tipo_teste text,
  resultado text,
  created_at timestamptz DEFAULT now()
);

-- 9. localizacoes_equipes (depends on equipes)
CREATE TABLE IF NOT EXISTS localizacoes_equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  data_hora timestamptz DEFAULT now(),
  status text,
  velocidade numeric,
  direcao numeric,
  ocorrencia_atual_id uuid,
  precisao_metros numeric,
  bateria_percentual numeric,
  created_at timestamptz DEFAULT now()
);

-- 10. pausas_equipes (depends on equipes)
CREATE TABLE IF NOT EXISTS pausas_equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('cafe_manha', 'almoco', 'cafe_tarde', 'jantar', 'descanso')),
  inicio_planejado timestamptz,
  fim_planejado timestamptz,
  inicio_real timestamptz,
  fim_real timestamptz,
  status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'em_andamento', 'concluida', 'cancelada')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 11. pontos_criticos (no dependencies)
CREATE TABLE IF NOT EXISTS pontos_criticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text CHECK (tipo IN ('hospital', 'subestacao', 'escola', 'abastecimento', 'outro')),
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  nivel_criticidade text CHECK (nivel_criticidade IN ('baixa', 'media', 'alta', 'critica')),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE usuarios_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE despachos_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE testes ENABLE ROW LEVEL SECURITY;
ALTER TABLE localizacoes_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pausas_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pontos_criticos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policies (all tables created, FKs now resolvable)
-- ============================================================

-- usuarios_sistema
DROP POLICY IF EXISTS "select_own_usuario" ON usuarios_sistema;
CREATE POLICY "select_own_usuario" ON usuarios_sistema
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "update_own_usuario" ON usuarios_sistema;
CREATE POLICY "update_own_usuario" ON usuarios_sistema
  FOR UPDATE TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- equipes
DROP POLICY IF EXISTS "select_equipe_for_member" ON equipes;
CREATE POLICY "select_equipe_for_member" ON equipes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = equipes.id
    )
  );

DROP POLICY IF EXISTS "update_equipe_for_member" ON equipes;
CREATE POLICY "update_equipe_for_member" ON equipes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = equipes.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = equipes.id
    )
  );

-- veiculos
DROP POLICY IF EXISTS "select_veiculo_for_member" ON veiculos;
CREATE POLICY "select_veiculo_for_member" ON veiculos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      JOIN equipes e ON e.id = us.equipe_id
      WHERE us.auth_user_id = auth.uid()
      AND e.veiculo_id = veiculos.id
    )
  );

-- ocorrencias
DROP POLICY IF EXISTS "select_ocorrencias_for_team" ON ocorrencias;
CREATE POLICY "select_ocorrencias_for_team" ON ocorrencias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM despachos_ocorrencias d
      JOIN usuarios_sistema us ON us.equipe_id = d.equipe_id
      WHERE d.ocorrencia_id = ocorrencias.id
      AND us.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_ocorrencias_for_team" ON ocorrencias;
CREATE POLICY "update_ocorrencias_for_team" ON ocorrencias
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM despachos_ocorrencias d
      JOIN usuarios_sistema us ON us.equipe_id = d.equipe_id
      WHERE d.ocorrencia_id = ocorrencias.id
      AND us.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM despachos_ocorrencias d
      JOIN usuarios_sistema us ON us.equipe_id = d.equipe_id
      WHERE d.ocorrencia_id = ocorrencias.id
      AND us.auth_user_id = auth.uid()
    )
  );

-- despachos_ocorrencias
DROP POLICY IF EXISTS "select_despachos_for_team" ON despachos_ocorrencias;
CREATE POLICY "select_despachos_for_team" ON despachos_ocorrencias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = despachos_ocorrencias.equipe_id
    )
  );

DROP POLICY IF EXISTS "insert_despachos_for_team" ON despachos_ocorrencias;
CREATE POLICY "insert_despachos_for_team" ON despachos_ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = despachos_ocorrencias.equipe_id
    )
  );

DROP POLICY IF EXISTS "update_despachos_for_team" ON despachos_ocorrencias;
CREATE POLICY "update_despachos_for_team" ON despachos_ocorrencias
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = despachos_ocorrencias.equipe_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = despachos_ocorrencias.equipe_id
    )
  );

-- atendimentos
DROP POLICY IF EXISTS "select_atendimentos_for_team" ON atendimentos;
CREATE POLICY "select_atendimentos_for_team" ON atendimentos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = atendimentos.equipe_id
    )
  );

DROP POLICY IF EXISTS "insert_atendimentos_for_team" ON atendimentos;
CREATE POLICY "insert_atendimentos_for_team" ON atendimentos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = atendimentos.equipe_id
    )
  );

DROP POLICY IF EXISTS "update_atendimentos_for_team" ON atendimentos;
CREATE POLICY "update_atendimentos_for_team" ON atendimentos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = atendimentos.equipe_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = atendimentos.equipe_id
    )
  );

-- diagnosticos
DROP POLICY IF EXISTS "select_diagnosticos_for_team" ON diagnosticos;
CREATE POLICY "select_diagnosticos_for_team" ON diagnosticos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      JOIN despachos_ocorrencias d ON d.equipe_id = us.equipe_id
      WHERE d.ocorrencia_id = diagnosticos.ocorrencia_id
      AND us.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_diagnosticos_for_team" ON diagnosticos;
CREATE POLICY "insert_diagnosticos_for_team" ON diagnosticos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      JOIN despachos_ocorrencias d ON d.equipe_id = us.equipe_id
      WHERE d.ocorrencia_id = diagnosticos.ocorrencia_id
      AND us.auth_user_id = auth.uid()
    )
  );

-- testes
DROP POLICY IF EXISTS "select_testes_for_team" ON testes;
CREATE POLICY "select_testes_for_team" ON testes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      JOIN despachos_ocorrencias d ON d.equipe_id = us.equipe_id
      WHERE d.ocorrencia_id = testes.ocorrencia_id
      AND us.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_testes_for_team" ON testes;
CREATE POLICY "insert_testes_for_team" ON testes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      JOIN despachos_ocorrencias d ON d.equipe_id = us.equipe_id
      WHERE d.ocorrencia_id = testes.ocorrencia_id
      AND us.auth_user_id = auth.uid()
    )
  );

-- localizacoes_equipes
DROP POLICY IF EXISTS "select_localizacoes_for_team" ON localizacoes_equipes;
CREATE POLICY "select_localizacoes_for_team" ON localizacoes_equipes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = localizacoes_equipes.equipe_id
    )
  );

DROP POLICY IF EXISTS "insert_localizacoes_for_team" ON localizacoes_equipes;
CREATE POLICY "insert_localizacoes_for_team" ON localizacoes_equipes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = localizacoes_equipes.equipe_id
    )
  );

DROP POLICY IF EXISTS "update_localizacoes_for_team" ON localizacoes_equipes;
CREATE POLICY "update_localizacoes_for_team" ON localizacoes_equipes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = localizacoes_equipes.equipe_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = localizacoes_equipes.equipe_id
    )
  );

-- pausas_equipes
DROP POLICY IF EXISTS "select_pausas_for_team" ON pausas_equipes;
CREATE POLICY "select_pausas_for_team" ON pausas_equipes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = pausas_equipes.equipe_id
    )
  );

DROP POLICY IF EXISTS "insert_pausas_for_team" ON pausas_equipes;
CREATE POLICY "insert_pausas_for_team" ON pausas_equipes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = pausas_equipes.equipe_id
    )
  );

DROP POLICY IF EXISTS "update_pausas_for_team" ON pausas_equipes;
CREATE POLICY "update_pausas_for_team" ON pausas_equipes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = pausas_equipes.equipe_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema us
      WHERE us.auth_user_id = auth.uid()
      AND us.equipe_id = pausas_equipes.equipe_id
    )
  );

-- pontos_criticos (reference data, readable by all authenticated)
DROP POLICY IF EXISTS "select_pontos_criticos" ON pontos_criticos;
CREATE POLICY "select_pontos_criticos" ON pontos_criticos
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON usuarios_sistema(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_equipe_id ON usuarios_sistema(equipe_id);
CREATE INDEX IF NOT EXISTS idx_despachos_equipe_id ON despachos_ocorrencias(equipe_id);
CREATE INDEX IF NOT EXISTS idx_despachos_ocorrencia_id ON despachos_ocorrencias(ocorrencia_id);
CREATE INDEX IF NOT EXISTS idx_despachos_status ON despachos_ocorrencias(status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_equipe_id ON atendimentos(equipe_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_ocorrencia_id ON atendimentos(ocorrencia_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_status ON atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_localizacoes_equipe_id ON localizacoes_equipes(equipe_id);
CREATE INDEX IF NOT EXISTS idx_pausas_equipe_id ON pausas_equipes(equipe_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_status ON ocorrencias(status);
CREATE INDEX IF NOT EXISTS idx_diagnosticos_ocorrencia_id ON diagnosticos(ocorrencia_id);
CREATE INDEX IF NOT EXISTS idx_testes_ocorrencia_id ON testes(ocorrencia_id);
