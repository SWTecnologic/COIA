import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Database } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { STATUS_DESPACHO, STATUS_OCORRENCIA, STATUS_EQUIPE, ACOES_ATENDIMENTO, PRIORIDADE_LABELS } from '@/lib/constants';
import { showAlert } from '@/lib/utils';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('[useDespachos] expo-notifications indisponível (Expo Go).');
}

type DespachoOcorrencia = Database['public']['Tables']['despachos_ocorrencias']['Row'];
type Ocorrencia = Database['public']['Tables']['ocorrencias']['Row'];
type Atendimento = Database['public']['Tables']['atendimentos']['Row'];

export interface DespachoCompleto extends DespachoOcorrencia {
  ocorrencia?: Ocorrencia;
  atendimento?: Atendimento | null;
}

export type AcaoAtendimento = typeof ACOES_ATENDIMENTO[keyof typeof ACOES_ATENDIMENTO];

export function useDespachos() {
  const [currentDespacho, setCurrentDespacho] = useState<DespachoCompleto | null>(null);
  const [pendingDespacho, setPendingDespacho] = useState<DespachoCompleto | null>(null);
  const [atendimentoHistory, setAtendimentoHistory] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, equipe } = useAuth();

  useEffect(() => {
    console.log('[useDespachos] 🔄 useEffect rodou', {
      hasUser: !!user,
      hasEquipe: !!equipe,
      equipeId: equipe?.id,
      configured: isSupabaseConfigured(),
    });

    if (!user || !equipe || !isSupabaseConfigured()) {
      console.log('[useDespachos] ⏸️ aguardando user/equipe/config');
      return;
    }

    loadDespachos();
    loadHistory();

    const subscription = supabase
      .channel('despachos')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'despachos_ocorrencias',
          filter: `equipe_id=eq.${equipe.id}`,
        },
        async (payload) => {
          console.log('[useDespachos] 🔔 INSERT recebido:', payload.new);
          const newDespacho = payload.new as DespachoOcorrencia;
          if (newDespacho.status === STATUS_DESPACHO.OFERTADA) {
            const { data } = await supabase
              .from('despachos_ocorrencias')
              .select('*, ocorrencia:ocorrencias(*)')
              .eq('id', newDespacho.id)
              .maybeSingle();

            if (data) {
              setPendingDespacho(data as DespachoCompleto);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'despachos_ocorrencias',
          filter: `equipe_id=eq.${equipe.id}`,
        },
        async (payload) => {
          console.log('[useDespachos] 🔄 UPDATE despacho:', payload.new);
          const updatedDespacho = payload.new as DespachoOcorrencia;
          if (updatedDespacho.status === STATUS_DESPACHO.EXPIRADA) {
            setPendingDespacho(null);
          }
          await loadDespachos();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ocorrencias',
        },
        async () => {
          console.log('[useDespachos] 🔄 UPDATE ocorrencia — recarregando');
          await loadDespachos();
        }
      )
      .subscribe((status) => {
        console.log('[useDespachos] 📡 realtime status:', status);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [user, equipe?.id]);

  const loadDespachos = async () => {
    if (!equipe) {
      console.log('[loadDespachos] ❌ equipe null, abortado');
      return;
    }

    console.log('[loadDespachos] 🔍 buscando para equipe:', equipe.id);
    setLoading(true);

    try {
      const { data: pending, error: pendingError } = await supabase
        .from('despachos_ocorrencias')
        .select('*, ocorrencia:ocorrencias(*)')
        .eq('equipe_id', equipe.id)
        .eq('status', STATUS_DESPACHO.OFERTADA)
        .maybeSingle();

      console.log('[loadDespachos] 📦 pending:', JSON.stringify(pending, null, 2));
      console.log('[loadDespachos] ⚠️ pendingError:', pendingError);

      setPendingDespacho(pending as DespachoCompleto | null);

      const { data: current, error: currentError } = await supabase
        .from('despachos_ocorrencias')
        .select('*, ocorrencia:ocorrencias(*)')
        .eq('equipe_id', equipe.id)
        .eq('status', STATUS_DESPACHO.ACEITA)
        .maybeSingle();

      console.log('[loadDespachos] 📦 current:', JSON.stringify(current, null, 2));
      console.log('[loadDespachos] ⚠️ currentError:', currentError);

      if (current) {
        const ocorrencia = (current as any).ocorrencia as Ocorrencia;
        let atendimento: Atendimento | null = null;
        if (ocorrencia) {
          const { data: attd } = await supabase
            .from('atendimentos')
            .select('*')
            .eq('ocorrencia_id', ocorrencia.id)
            .eq('equipe_id', equipe.id)
            .maybeSingle();
          atendimento = attd as Atendimento | null;
        }
        setCurrentDespacho({ ...current, atendimento } as DespachoCompleto);
      } else {
        setCurrentDespacho(null);
      }
    } catch (error) {
      console.error('[loadDespachos] ❌ erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!equipe) return;

    try {
      const { data } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('equipe_id', equipe.id)
        .eq('status', 'concluido')
        .order('data_hora_encerramento', { ascending: false })
        .limit(50);

      setAtendimentoHistory(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const acceptDespacho = async (despachoId: string) => {
    if (!equipe) return;

    setLoading(true);
    try {
      const { error: despachoError } = await supabase
        .from('despachos_ocorrencias')
        .update({
          status: STATUS_DESPACHO.ACEITA,
          respondido_em: new Date().toISOString(),
        })
        .eq('id', despachoId);

      if (despachoError) throw despachoError;

      const { data: despacho } = await supabase
        .from('despachos_ocorrencias')
        .select('*')
        .eq('id', despachoId)
        .maybeSingle();

      if (despacho) {
        const { data: existingAttd } = await supabase
          .from('atendimentos')
          .select('id')
          .eq('ocorrencia_id', despacho.ocorrencia_id)
          .eq('equipe_id', equipe.id)
          .maybeSingle();

        if (!existingAttd) {
          await supabase.from('atendimentos').insert({
            ocorrencia_id: despacho.ocorrencia_id,
            equipe_id: equipe.id,
            data_hora_aceite: new Date().toISOString(),
            status: 'em_andamento',
          });
        }

        await supabase
          .from('ocorrencias')
          .update({ status: STATUS_OCORRENCIA.EM_ANALISE })
          .eq('id', despacho.ocorrencia_id);

        await supabase
          .from('equipes')
          .update({ status: STATUS_EQUIPE.EM_DESLOCAMENTO })
          .eq('id', equipe.id);
      }

      setPendingDespacho(null);
      await loadDespachos();
    } catch (error) {
      console.error('Error accepting despacho:', error);
      showAlert('Erro', 'Não foi possível aceitar a ocorrência');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const rejectDespacho = async (despachoId: string) => {
    setPendingDespacho(null);
    try {
      await supabase
        .from('despachos_ocorrencias')
        .update({
          status: STATUS_DESPACHO.RECUSADA,
          respondido_em: new Date().toISOString(),
        })
        .eq('id', despachoId);
    } catch (error) {
      console.error('Error rejecting despacho:', error);
    }
  };

  const executarAcao = async (
    ocorrenciaId: string,
    acao: AcaoAtendimento,
    dadosExtra?: {
      tipo_problema?: string;
      descricao?: string;
      gravidade?: string;
      servico_necessario?: string;
      material_necessario?: string;
      tipo_teste?: string;
      resultado?: string;
    }
  ) => {
    if (!equipe || !currentDespacho) return;

    setLoading(true);
    try {
      const now = new Date().toISOString();
      const atendimentoId = currentDespacho.atendimento?.id;

      switch (acao) {
        case ACOES_ATENDIMENTO.SAIR:
          await supabase.from('atendimentos').update({ data_hora_saida: now }).eq('ocorrencia_id', ocorrenciaId).eq('equipe_id', equipe.id);
          await supabase.from('ocorrencias').update({ status: STATUS_OCORRENCIA.EQUIPE_EM_DESLOCAMENTO }).eq('id', ocorrenciaId);
          await supabase.from('equipes').update({ status: STATUS_EQUIPE.EM_DESLOCAMENTO }).eq('id', equipe.id);
          break;

        case ACOES_ATENDIMENTO.CHEGAR:
          await supabase.from('atendimentos').update({ data_hora_chegada: now }).eq('ocorrencia_id', ocorrenciaId).eq('equipe_id', equipe.id);
          await supabase.from('ocorrencias').update({ status: STATUS_OCORRENCIA.EQUIPE_NO_LOCAL }).eq('id', ocorrenciaId);
          await supabase.from('equipes').update({ status: STATUS_EQUIPE.NO_LOCAL }).eq('id', equipe.id);
          break;

        case ACOES_ATENDIMENTO.INICIAR_DIAGNOSTICO:
          await supabase.from('atendimentos').update({ data_hora_inicio_diagnostico: now }).eq('ocorrencia_id', ocorrenciaId).eq('equipe_id', equipe.id);
          await supabase.from('ocorrencias').update({ status: STATUS_OCORRENCIA.DIAGNOSTICO }).eq('id', ocorrenciaId);
          break;

        case ACOES_ATENDIMENTO.REGISTRAR_DIAGNOSTICO:
          await supabase.from('diagnosticos').insert({
            ocorrencia_id: ocorrenciaId,
            atendimento_id: atendimentoId || null,
            tipo_problema: dadosExtra?.tipo_problema || null,
            descricao: dadosExtra?.descricao || null,
            gravidade: (dadosExtra?.gravidade as any) || null,
            servico_necessario: dadosExtra?.servico_necessario || null,
            material_necessario: dadosExtra?.material_necessario || null,
          });
          await supabase.from('atendimentos').update({ data_hora_fim_diagnostico: now }).eq('ocorrencia_id', ocorrenciaId).eq('equipe_id', equipe.id);
          break;

        case ACOES_ATENDIMENTO.INICIAR_REPARO:
          await supabase.from('atendimentos').update({ data_hora_inicio_reparo: now }).eq('ocorrencia_id', ocorrenciaId).eq('equipe_id', equipe.id);
          await supabase.from('ocorrencias').update({ status: STATUS_OCORRENCIA.EM_REPARO }).eq('id', ocorrenciaId);
          break;

        case ACOES_ATENDIMENTO.FINALIZAR_REPARO:
          await supabase.from('atendimentos').update({ data_hora_fim_reparo: now }).eq('ocorrencia_id', ocorrenciaId).eq('equipe_id', equipe.id);
          break;

        case ACOES_ATENDIMENTO.REGISTRAR_TESTE:
          await supabase.from('testes').insert({
            ocorrencia_id: ocorrenciaId,
            atendimento_id: atendimentoId || null,
            tipo_teste: dadosExtra?.tipo_teste || null,
            resultado: dadosExtra?.resultado || null,
          });
          await supabase.from('atendimentos').update({
            data_hora_inicio_teste: now,
            data_hora_fim_teste: now,
          }).eq('ocorrencia_id', ocorrenciaId).eq('equipe_id', equipe.id);
          await supabase.from('ocorrencias').update({ status: STATUS_OCORRENCIA.EM_TESTE }).eq('id', ocorrenciaId);
          break;

        case ACOES_ATENDIMENTO.RELIGAR:
          await supabase.from('atendimentos').update({ data_hora_religacao: now }).eq('ocorrencia_id', ocorrenciaId).eq('equipe_id', equipe.id);
          await supabase.from('ocorrencias').update({ status: STATUS_OCORRENCIA.AGUARDANDO_RELIGACAO }).eq('id', ocorrenciaId);
          break;

        case ACOES_ATENDIMENTO.ENCERRAR:
          await supabase.from('atendimentos').update({
            data_hora_restabelecimento: now,
            data_hora_encerramento: now,
            status: 'concluido',
          }).eq('ocorrencia_id', ocorrenciaId).eq('equipe_id', equipe.id);
          await supabase.from('ocorrencias').update({
            status: STATUS_OCORRENCIA.RESTABELECIDA,
            data_hora_encerramento: now,
          }).eq('id', ocorrenciaId);
          await supabase.from('equipes').update({ status: STATUS_EQUIPE.DISPONIVEL }).eq('id', equipe.id);
          await supabase.from('localizacoes_equipes')
            .update({ ocorrencia_atual_id: null })
            .eq('equipe_id', equipe.id);
          break;
      }

      await loadDespachos();
    } catch (error) {
      console.error('Error executing action:', error);
      showAlert('Erro', 'Não foi possível executar a ação');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    currentDespacho,
    pendingDespacho,
    atendimentoHistory,
    loading,
    acceptDespacho,
    rejectDespacho,
    executarAcao,
    refreshDespachos: () => {
      loadDespachos();
      loadHistory();
    },
  };
}