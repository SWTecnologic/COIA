import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, validateEnvironment } from '@/lib/constants';
import { Database } from '@/types/database';

// Validar ambiente na inicialização
try {
  validateEnvironment();
} catch (error) {
  console.error('Erro de configuração:', error);
  throw error;
}

// Criar cliente Supabase
export const supabase = createClient<Database>(
  SUPABASE_CONFIG.url!,
  SUPABASE_CONFIG.anonKey!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Verificar se o Supabase está configurado
export const isSupabaseConfigured = (): boolean => {
  return !!(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
};

// Testar conexão
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('usuarios_sistema').select('count').limit(1);
    return !error;
  } catch (error) {
    console.error('Erro ao testar conexão Supabase:', error);
    return false;
  }
};
