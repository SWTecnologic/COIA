import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Alert, Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Database } from '@/types/database';
import { validateEnvironment } from '@/lib/constants';

type UsuarioSistema = Database['public']['Tables']['usuarios_sistema']['Row'];
type Equipe = Database['public']['Tables']['equipes']['Row'];
type Veiculo = Database['public']['Tables']['veiculos']['Row'];

interface AuthContextType {
  user: User | null;
  profile: UsuarioSistema | null;
  equipe: Equipe | null;
  veiculo: Veiculo | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UsuarioSistema | null>(null);
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      validateEnvironment();
    } catch (error) {
      console.error('Environment validation failed:', error);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured()) {
      console.error('Supabase not configured');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await loadUserData(session.user.id);
        })();
      } else {
        setProfile(null);
        setEquipe(null);
        setVeiculo(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      setLoading(true);
      console.log('[AuthContext] ========== INÍCIO loadUserData ==========');
      console.log('[AuthContext] userId:', userId);

      // 1. Buscar usuário no sistema
      console.log('[AuthContext] Buscando usuarios_sistema...');
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();

      console.log('[AuthContext] usuarioData:', JSON.stringify(usuarioData, null, 2));
      console.log('[AuthContext] usuarioError:', JSON.stringify(usuarioError, null, 2));

      if (usuarioError) throw usuarioError;

      if (!usuarioData) {
        console.warn('[AuthContext] ❌ usuarioData é null — provavelmente RLS bloqueando');
        setProfile(null);
        setEquipe(null);
        setVeiculo(null);
        setLoading(false);
        return;
      }

      // 2. Se for gerente, alertar
      if (usuarioData.tipo_usuario === 'gerente') {
        Alert.alert(
          'Acesso Restrito',
          'Gerentes devem usar o dashboard web. Este app é exclusivo para técnicos de campo.',
          [{ text: 'OK', onPress: () => signOut() }]
        );
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(usuarioData);
      console.log('[AuthContext] ✅ profile setado');

      // 3. Buscar equipe
      if (usuarioData.equipe_id) {
        console.log('[AuthContext] Buscando equipe id:', usuarioData.equipe_id);

        const { data: equipeData, error: equipeError } = await supabase
          .from('equipes')
          .select('*')
          .eq('id', usuarioData.equipe_id)
          .maybeSingle();

        console.log('[AuthContext] equipeData:', JSON.stringify(equipeData, null, 2));
        console.log('[AuthContext] equipeError:', JSON.stringify(equipeError, null, 2));

        if (equipeError) throw equipeError;

        if (!equipeData) {
          console.warn('[AuthContext] ❌ equipeData é null — provavelmente RLS bloqueando');
          setEquipe(null);
          setVeiculo(null);
        } else {
          setEquipe(equipeData);
          console.log('[AuthContext] ✅ equipe setada:', equipeData.nome);

          // 4. Buscar veículo (opcional)
          if (equipeData.veiculo_id) {
            console.log('[AuthContext] Buscando veículo id:', equipeData.veiculo_id);

            const { data: veiculoData, error: veiculoError } = await supabase
              .from('veiculos')
              .select('*')
              .eq('id', equipeData.veiculo_id)
              .maybeSingle();

            console.log('[AuthContext] veiculoData:', JSON.stringify(veiculoData, null, 2));

            if (veiculoError) {
              console.warn('[AuthContext] Erro ao buscar veículo (não crítico):', veiculoError);
              setVeiculo(null);
            } else {
              setVeiculo(veiculoData);
            }
          } else {
            console.log('[AuthContext] Equipe sem veículo vinculado');
            setVeiculo(null);
          }
        }
      } else {
        console.warn('[AuthContext] ❌ usuarioData.equipe_id é null');
        setEquipe(null);
        setVeiculo(null);
      }

      console.log('[AuthContext] ========== FIM loadUserData ==========');
    } catch (error) {
      console.error('[AuthContext] ❌ ERRO em loadUserData:', error);
      console.error('[AuthContext] Erro detalhado:', JSON.stringify(error, null, 2));
      if (Platform.OS !== 'web') {
        Alert.alert('Erro', `Falha ao carregar dados: ${(error as Error).message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setEquipe(null);
    setVeiculo(null);
  };

  const value: AuthContextType = {
    user,
    profile,
    equipe,
    veiculo,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}