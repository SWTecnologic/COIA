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

// Status dos despachos
export const STATUS_DESPACHO = {
  OFERTADA: 'ofertada',
  ACEITA: 'aceita',
  RECUSADA: 'recusada',
  EXPIRADA: 'expirada',
} as const;

export const STATUS_DESPACHO_LABELS = {
  [STATUS_DESPACHO.OFERTADA]: 'Ofertada',
  [STATUS_DESPACHO.ACEITA]: 'Aceita',
  [STATUS_DESPACHO.RECUSADA]: 'Recusada',
  [STATUS_DESPACHO.EXPIRADA]: 'Expirada',
} as const;

// Status das ocorrências
export const STATUS_OCORRENCIA = {
  NOVA: 'nova',
  EM_ANALISE: 'em_analise',
  EQUIPE_EM_DESLOCAMENTO: 'equipe_em_deslocamento',
  EQUIPE_NO_LOCAL: 'equipe_no_local',
  DIAGNOSTICO: 'diagnostico',
  EM_REPARO: 'em_reparo',
  EM_TESTE: 'em_teste',
  AGUARDANDO_RELIGACAO: 'aguardando_religacao',
  RESTABELECIDA: 'restabelecida',
  CANCELADA: 'cancelada',
} as const;

export const STATUS_OCORRENCIA_LABELS = {
  [STATUS_OCORRENCIA.NOVA]: 'Nova',
  [STATUS_OCORRENCIA.EM_ANALISE]: 'Em Análise',
  [STATUS_OCORRENCIA.EQUIPE_EM_DESLOCAMENTO]: 'Equipe em Deslocamento',
  [STATUS_OCORRENCIA.EQUIPE_NO_LOCAL]: 'Equipe no Local',
  [STATUS_OCORRENCIA.DIAGNOSTICO]: 'Diagnóstico',
  [STATUS_OCORRENCIA.EM_REPARO]: 'Em Reparo',
  [STATUS_OCORRENCIA.EM_TESTE]: 'Em Teste',
  [STATUS_OCORRENCIA.AGUARDANDO_RELIGACAO]: 'Aguardando Religação',
  [STATUS_OCORRENCIA.RESTABELECIDA]: 'Restabelecida',
  [STATUS_OCORRENCIA.CANCELADA]: 'Cancelada',
} as const;

// Prioridades
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

// Status das equipes
export const STATUS_EQUIPE = {
  DISPONIVEL: 'disponivel',
  EM_DESLOCAMENTO: 'em_deslocamento',
  NO_LOCAL: 'no_local',
  EM_PAUSA: 'em_pausa',
  INDISPONIVEL: 'indisponivel',
} as const;

export const STATUS_EQUIPE_LABELS = {
  [STATUS_EQUIPE.DISPONIVEL]: 'Disponível',
  [STATUS_EQUIPE.EM_DESLOCAMENTO]: 'Em Deslocamento',
  [STATUS_EQUIPE.NO_LOCAL]: 'No Local',
  [STATUS_EQUIPE.EM_PAUSA]: 'Em Pausa',
  [STATUS_EQUIPE.INDISPONIVEL]: 'Indisponível',
} as const;

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
  UPDATE_INTERVAL: 10000, // 10 segundos
  MIN_DISTANCE: 10, // 10 metros
  ACCURACY_THRESHOLD: 100, // 100 metros
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
