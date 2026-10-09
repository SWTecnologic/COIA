export interface Chamado {
  id: string;
  protocolo: string | null;
  tipo: string | null;
  ocorrencia_id: string | null;
  data_hora: string | null;
}

export interface Ocorrencia {
  id: string;
  protocolo: string | null;
  ia_prioridade_final: string | null;
  ia_previsao_restabelecimento: string | null;
  ia_confianca: number | null;
  ia_atualizado_em: string | null;
}

export interface IaCorrelacao {
  id: string;
  ocorrencia_id: string | null;
  chamado_id: string | null;
  distancia_m: number | null;
  score: number | null;
  motivo: string | null;
  criado_em: string | null;
}

export interface IaPrioridade {
  id: string;
  ocorrencia_id: string | null;
  prioridade_final: string | null;
  motivo: string | null;
  criado_em: string | null;
}

export interface IaRecomendacaoEquipe {
  id: string;
  ocorrencia_id: string | null;
  equipe_id: string | null;
  distancia_km: number | null;
  eta_minutos: number | null;
  pontuacao: number | null;
  posicao: number | null;
  criado_em: string | null;
}

export interface IaPrevisao {
  id: string;
  ocorrencia_id: string | null;
  tipo: string | null;
  tempo_estimado_min: number | null;
  horario_estimado: string | null;
  confianca: number | null;
  modelo_versao: string | null;
  criado_em: string | null;
}

export interface IaAnalise {
  id: string;
  entidade: string | null;
  entidade_id: string | null;
  tipo_analise: string | null;
  resultado: string | null;
  confianca: number | null;
  justificativa: string | null;
  modelo_versao: string | null;
  criado_em: string | null;
}

export interface HistoricoOperacional {
  id: string;
  entidade: string | null;
  entidade_id: string | null;
  acao: string | null;
  usuario: string | null;
  resultado: string | null;
  observacoes: string | null;
  criado_em: string | null;
}

export interface Atendimento {
  id: string;
  ocorrencia_id: string | null;
  equipe_id: string | null;
  status: string | null;
  data_hora_aceite: string | null;
  data_hora_restabelecimento: string | null;
}
