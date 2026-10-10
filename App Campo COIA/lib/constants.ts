import Constants from 'expo-constants';

// Cor principal do app
export const PRIMARY_COLOR = '#7C3AED';

// Configurações do app
export const APP_CONFIG = {
  name: Constants.expoConfig?.extra?.appName || 'COIA Campo',
  version: Constants.expoConfig?.extra?.appVersion || '1.0.0',
  environment: Constants.expoConfig?.extra?.environment || 'development',
  googleMapsApiKey: Constants.expoConfig?.extra?.googleMapsApiKey,
};

// Configurações do Supabase
export const SUPABASE_CONFIG = {
  url: Constants.expoConfig?.extra?.supabaseUrl,
  anonKey: Constants.expoConfig?.extra?.supabaseAnonKey,
};

// Validação de ambiente
export const validateEnvironment = () => {
  const requiredVars = [
    { key: 'SUPABASE_URL', value: SUPABASE_CONFIG.url },
    { key: 'SUPABASE_ANON_KEY', value: SUPABASE_CONFIG.anonKey },
  ];

  const missing = requiredVars.filter(({ value }) => !value);

  if (missing.length > 0) {
    const missingKeys = missing.map(({ key }) => key).join(', ');
    throw new Error(`Variáveis de ambiente obrigatórias não encontradas: ${missingKeys}`);
  }
};

// ==========================================================
// STATUS DE DESPACHO
// Fonte da verdade: CHECK constraint em public.despachos_ocorrencias
// ==========================================================
export const STATUS_DESPACHO = {
  OFERTADA: 'ofertada',
  ACEITA: 'aceita',
  RECUSADA: 'recusada',
  EXPIRADA: 'expirada',
  CANCELADA: 'cancelada',   // ✅ ADICIONADO (existe no schema)
} as const;

export const STATUS_DESPACHO_LABELS = {
  [STATUS_DESPACHO.OFERTADA]: 'Ofertada',
  [STATUS_DESPACHO.ACEITA]: 'Aceita',
  [STATUS_DESPACHO.RECUSADA]: 'Recusada',
  [STATUS_DESPACHO.EXPIRADA]: 'Expirada',
  [STATUS_DESPACHO.CANCELADA]: 'Cancelada',
} as const;

// ==========================================================
// STATUS DE OCORRÊNCIA
// Fonte da verdade: CHECK constraint em public.ocorrencias
// ==========================================================
export const STATUS_OCORRENCIA = {
  NOVA: 'nova',
  REGISTRADA: 'registrada',                       // ✅ ADICIONADO
  EM_ANALISE: 'em_analise',
  AGUARDANDO_EQUIPE: 'aguardando_equipe',         // ✅ ADICIONADO
  EQUIPE_EM_DESLOCAMENTO: 'equipe_em_deslocamento',
  EQUIPE_NO_LOCAL: 'equipe_no_local',
  DIAGNOSTICO: 'diagnostico',
  AGUARDANDO_MATERIAL: 'aguardando_material',     // ✅ ADICIONADO
  EM_REPARO: 'em_reparo',
  EM_TESTE: 'em_teste',
  AGUARDANDO_RELIGACAO: 'aguardando_religacao',
  RESTABELECIDA: 'restabelecida',
  CANCELADA: 'cancelada',
} as const;

export const STATUS_OCORRENCIA_LABELS = {
  [STATUS_OCORRENCIA.NOVA]: 'Nova',
  [STATUS_OCORRENCIA.REGISTRADA]: 'Registrada',
  [STATUS_OCORRENCIA.EM_ANALISE]: 'Em Análise',
  [STATUS_OCORRENCIA.AGUARDANDO_EQUIPE]: 'Aguardando Equipe',
  [STATUS_OCORRENCIA.EQUIPE_EM_DESLOCAMENTO]: 'Equipe em Deslocamento',
  [STATUS_OCORRENCIA.EQUIPE_NO_LOCAL]: 'Equipe no Local',
  [STATUS_OCORRENCIA.DIAGNOSTICO]: 'Diagnóstico',
  [STATUS_OCORRENCIA.AGUARDANDO_MATERIAL]: 'Aguardando Material',
  [STATUS_OCORRENCIA.EM_REPARO]: 'Em Reparo',
  [STATUS_OCORRENCIA.EM_TESTE]: 'Em Teste',
  [STATUS_OCORRENCIA.AGUARDANDO_RELIGACAO]: 'Aguardando Religação',
  [STATUS_OCORRENCIA.RESTABELECIDA]: 'Restabelecida',
  [STATUS_OCORRENCIA.CANCELADA]: 'Cancelada',
} as const;

// Status considerados FINAIS (não devem mais gerar botão)
export const STATUS_OCORRENCIA_FINAL = [
  STATUS_OCORRENCIA.RESTABELECIDA,
  STATUS_OCORRENCIA.CANCELADA,
] as const;

// ==========================================================
// STATUS DE ATENDIMENTO
// Fonte da verdade: CHECK constraint em public.atendimentos
// ==========================================================
export const STATUS_ATENDIMENTO = {
  EM_ANDAMENTO: 'em_andamento',
  CONCLUIDO: 'concluido',
  CANCELADO: 'cancelado',
} as const;

// ==========================================================
// PRIORIDADES
// Fonte da verdade: CHECK constraint em public.ocorrencias
// ==========================================================
export const PRIORIDADE = {
  URGENTE: 'urgente',
  PRIORIDADE: 'prioridade',
  ORDEM_CHAMADA: 'ordem_chamada',
} as const;

export const PRIORIDADE_LABELS = {
  [PRIORIDADE.URGENTE]: 'Urgente',
  [PRIORIDADE.PRIORIDADE]: 'Prioridade',
  [PRIORIDADE.ORDEM_CHAMADA]: 'Ordem de Chamada',
} as const;

export const PRIORIDADE_COLORS = {
  [PRIORIDADE.URGENTE]: '#EF4444',
  [PRIORIDADE.PRIORIDADE]: '#F97316',
  [PRIORIDADE.ORDEM_CHAMADA]: '#22C55E',
} as const;

// ==========================================================
// STATUS DE EQUIPE
// Fonte da verdade: CHECK constraint em public.equipes
// ==========================================================
export const STATUS_EQUIPE = {
  FORA_DO_TURNO: 'fora_do_turno',
  AGUARDANDO_ONLINE: 'aguardando_online',
  DISPONIVEL: 'disponivel',
  EM_DESLOCAMENTO: 'em_deslocamento',
  NO_LOCAL: 'no_local',
  EM_ATENDIMENTO: 'em_atendimento',
  EM_PAUSA: 'em_pausa',
  OFFLINE: 'offline',
  INDISPONIVEL: 'indisponivel',
} as const;

export const STATUS_EQUIPE_LABELS = {
  [STATUS_EQUIPE.FORA_DO_TURNO]: 'Fora do Turno',
  [STATUS_EQUIPE.AGUARDANDO_ONLINE]: 'Aguardando Online',
  [STATUS_EQUIPE.DISPONIVEL]: 'Disponível',
  [STATUS_EQUIPE.EM_DESLOCAMENTO]: 'Em Deslocamento',
  [STATUS_EQUIPE.NO_LOCAL]: 'No Local',
  [STATUS_EQUIPE.EM_ATENDIMENTO]: 'Em Atendimento',
  [STATUS_EQUIPE.EM_PAUSA]: 'Em Pausa',
  [STATUS_EQUIPE.OFFLINE]: 'Offline',
  [STATUS_EQUIPE.INDISPONIVEL]: 'Indisponível',
} as const;

// Status de equipe que contam como "offline/não operante"
export const STATUS_EQUIPE_OFFLINE_VALUES = [
  STATUS_EQUIPE.INDISPONIVEL,
  STATUS_EQUIPE.OFFLINE,
  STATUS_EQUIPE.FORA_DO_TURNO,
  STATUS_EQUIPE.AGUARDANDO_ONLINE,
] as const;

// Status de equipe que impedem aceitar nova ocorrência
export const STATUS_EQUIPE_EM_OPERACAO_VALUES = [
  STATUS_EQUIPE.EM_DESLOCAMENTO,
  STATUS_EQUIPE.NO_LOCAL,
  STATUS_EQUIPE.EM_ATENDIMENTO,
] as const;

// Tipos de ocorrência
export const TIPO_OCORRENCIA_LABELS: Record<string, string> = {
  sem_energia: 'Sem Energia',
  cabo_rompido: 'Cabo Rompido',
  curto_circuito: 'Curto Circuito',
  sobrecarga: 'Sobrecarga',
  manutencao_preventiva: 'Manutenção Preventiva',
  religacao: 'Religação',
  outro: 'Outro',
};

// Tipos de pausa
export const TIPO_PAUSA_LABELS: Record<string, string> = {
  cafe_manha: 'Café da Manhã',
  almoco: 'Almoço',
  cafe_tarde: 'Café da Tarde',
  jantar: 'Jantar',
  descanso: 'Descanso',
};

// Tipos de veículo
export const TIPO_VEICULO_LABELS: Record<string, string> = {
  caminhao: 'Caminhão',
  pickup: 'Pickup',
  moto: 'Moto',
  van: 'Van',
};

// Configurações de localização
export const LOCATION_CONFIG = {
  UPDATE_INTERVAL: 10000,
  MIN_DISTANCE: 10,
  ACCURACY_THRESHOLD: 100,
};

// Ações do fluxo de atendimento
export const ACOES_ATENDIMENTO = {
  SAIR: 'sair',
  CHEGAR: 'chegar',
  INICIAR_DIAGNOSTICO: 'iniciar_diagnostico',
  REGISTRAR_DIAGNOSTICO: 'registrar_diagnostico',
  INICIAR_REPARO: 'iniciar_reparo',
  FINALIZAR_REPARO: 'finalizar_reparo',
  REGISTRAR_TESTE: 'registrar_teste',
  RELIGAR: 'religar',
  ENCERRAR: 'encerrar',
} as const;