
import { useState, useEffect, useCallback } from 'react';

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Database } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

import {
  STATUS_DESPACHO,
  STATUS_OCORRENCIA,
  STATUS_EQUIPE,
  ACOES_ATENDIMENTO,
} from '@/lib/constants';

import { showAlert } from '@/lib/utils';

// ======================================================
// TIPOS
// ======================================================

type DespachoOcorrencia =
  Database['public']['Tables']['despachos_ocorrencias']['Row'];

type Ocorrencia =
  Database['public']['Tables']['ocorrencias']['Row'];

type Atendimento =
  Database['public']['Tables']['atendimentos']['Row'];

export interface DespachoCompleto extends DespachoOcorrencia {
  ocorrencia?: Ocorrencia;
  atendimento?: Atendimento | null;
}

export type AcaoAtendimento =
  typeof ACOES_ATENDIMENTO[keyof typeof ACOES_ATENDIMENTO];

type ResultadoSupabase = {
  data: any;
  error: any;
};

// ======================================================
// TRATAMENTO DE ERROS
// ======================================================

async function verificarResultado(
  consulta: PromiseLike<ResultadoSupabase>,
  operacao: string
) {
  const { data, error } = await consulta;

  if (error) {
    console.error(`[useDespachos] ${operacao}:`, error);
    throw new Error(`${operacao}: ${error.message}`);
  }

  return data;
}

// ======================================================
// AUXILIARES
// ======================================================

function obterOcorrencia(
  despacho: any
): Ocorrencia | null {
  const ocorrencia = despacho?.ocorrencia;

  if (Array.isArray(ocorrencia)) {
    return ocorrencia[0] ?? null;
  }

  return ocorrencia ?? null;
}

function ocorrenciaFinalizada(
  ocorrencia: Ocorrencia | null | undefined
): boolean {
  if (!ocorrencia) return true;

  return (
    ocorrencia.status === STATUS_OCORRENCIA.RESTABELECIDA ||
    ocorrencia.status === STATUS_OCORRENCIA.CANCELADA
  );
}

function atendimentoFinalizado(
  atendimento: Atendimento | null | undefined
): boolean {
  if (!atendimento) return false;

  return (
    atendimento.status === 'concluido' ||
    atendimento.status === 'cancelado'
  );
}

// ======================================================
// HOOK PRINCIPAL
// ======================================================

export function useDespachos() {
  const [currentDespacho, setCurrentDespacho] =
    useState<DespachoCompleto | null>(null);

  const [pendingDespacho, setPendingDespacho] =
    useState<DespachoCompleto | null>(null);

  const [atendimentoHistory, setAtendimentoHistory] =
    useState<Atendimento[]>([]);

  const [loading, setLoading] = useState(true);

  const { user, equipe } = useAuth();

  // ====================================================
  // CARREGAR DESPACHOS
  // ====================================================

  const loadDespachos = useCallback(async () => {
    if (!equipe || !isSupabaseConfigured()) {
      setCurrentDespacho(null);
      setPendingDespacho(null);
      setLoading(false);
      return;
    }

    const equipeId = equipe.id;

    console.log(
      '[loadDespachos] Buscando despachos da equipe:',
      equipeId
    );

    setLoading(true);

    try {
      // -----------------------------------------------
      // 1. Buscar ofertas pendentes
      //
      // Não usar maybeSingle() nesta consulta:
      // pode haver mais de uma oferta antiga no banco.
      // Buscamos uma lista e selecionamos uma oferta válida.
      // -----------------------------------------------

      const pendingRows = await verificarResultado(
        supabase
          .from('despachos_ocorrencias')
          .select('*, ocorrencia:ocorrencias(*)')
          .eq('equipe_id', equipeId)
          .eq('status', STATUS_DESPACHO.OFERTADA)
          .order('enviado_em', { ascending: false })
          .limit(50),
        'Carregar despachos pendentes'
      );

      const pendentes =
        (pendingRows ?? []) as DespachoCompleto[];

      const despachoPendente = pendentes.find((despacho) => {
        const ocorrencia = obterOcorrencia(despacho);

        return !ocorrenciaFinalizada(ocorrencia);
      });

      setPendingDespacho(
        despachoPendente
          ? {
              ...despachoPendente,
              ocorrencia: obterOcorrencia(despachoPendente) ?? undefined,
            }
          : null
      );

      if (despachoPendente) {
        console.log('[loadDespachos] Oferta pendente:', {
          despachoId: despachoPendente.id,
          ocorrenciaId: despachoPendente.ocorrencia_id,
        });
      }

      // -----------------------------------------------
      // 2. Buscar despachos aceitos
      //
      // Corrige o PGRST116: a consulta retorna uma lista,
      // pois pode existir mais de um despacho com status
      // "aceita" para a mesma equipe.
      // -----------------------------------------------

      const currentRows = await verificarResultado(
        supabase
          .from('despachos_ocorrencias')
          .select('*, ocorrencia:ocorrencias(*)')
          .eq('equipe_id', equipeId)
          .eq('status', STATUS_DESPACHO.ACEITA)
          .order('enviado_em', { ascending: false })
          .limit(50),
        'Carregar despachos aceitos'
      );

      const aceitos =
        (currentRows ?? []) as DespachoCompleto[];

      let despachoSelecionado: DespachoCompleto | null = null;
      let atendimentoSelecionado: Atendimento | null = null;

      // -----------------------------------------------
      // 3. Selecionar o primeiro despacho realmente ativo
      //
      // Ignora:
      // - ocorrências encerradas;
      // - ocorrências canceladas;
      // - despachos sem ocorrência relacionada;
      // - atendimentos já concluídos ou cancelados.
      //
      // A lista está ordenada do mais recente para o mais
      // antigo, portanto priorizamos o despacho válido
      // mais recente.
      // -----------------------------------------------

      for (const despacho of aceitos) {
        const ocorrencia = obterOcorrencia(despacho);

        if (ocorrenciaFinalizada(ocorrencia)) {
          console.log(
            '[loadDespachos] Ignorando despacho de ocorrência finalizada:',
            {
              despachoId: despacho.id,
              ocorrenciaId: despacho.ocorrencia_id,
              status: ocorrencia?.status ?? 'ocorrencia_nao_encontrada',
            }
          );

          continue;
        }

        // ---------------------------------------------
        // 4. Buscar atendimento da ocorrência
        //
        // Também usamos lista + limit(1), evitando
        // PGRST116 caso existam atendimentos duplicados.
        // ---------------------------------------------

        const atendimentoRows = await verificarResultado(
          supabase
            .from('atendimentos')
            .select('*')
            .eq('ocorrencia_id', ocorrencia!.id)
            .eq('equipe_id', equipeId)
            .order('created_at', { ascending: false })
            .limit(1),
          'Carregar atendimento'
        );

        const atendimento =
          ((atendimentoRows ?? [])[0] ?? null) as Atendimento | null;

        if (atendimentoFinalizado(atendimento)) {
          console.log(
            '[loadDespachos] Ignorando atendimento finalizado:',
            {
              despachoId: despacho.id,
              atendimentoId: atendimento?.id,
              status: atendimento?.status,
            }
          );

          continue;
        }

        despachoSelecionado = {
          ...despacho,
          ocorrencia,
          atendimento,
        };

        atendimentoSelecionado = atendimento;
        break;
      }

      // -----------------------------------------------
      // 5. Atualizar o estado do despacho ativo
      // -----------------------------------------------

      if (!despachoSelecionado) {
        setCurrentDespacho(null);

        console.log(
          '[loadDespachos] Nenhum despacho ativo válido encontrado.'
        );

        return;
      }

      setCurrentDespacho({
        ...despachoSelecionado,
        atendimento: atendimentoSelecionado,
      });

      console.log('[loadDespachos] Despacho ativo selecionado:', {
        despachoId: despachoSelecionado.id,
        ocorrenciaId: despachoSelecionado.ocorrencia?.id,
        statusOcorrencia: despachoSelecionado.ocorrencia?.status,
        atendimentoId: atendimentoSelecionado?.id ?? null,
      });
    } catch (error) {
      console.error(
        '[loadDespachos] Erro ao carregar despachos:',
        error
      );
    } finally {
      setLoading(false);
    }
  }, [equipe?.id]);

  // ====================================================
  // HISTÓRICO DE ATENDIMENTOS
  // ====================================================

  const loadHistory = useCallback(async () => {
    if (!equipe || !isSupabaseConfigured()) {
      return;
    }

    try {
      const data = await verificarResultado(
        supabase
          .from('atendimentos')
          .select('*')
          .eq('equipe_id', equipe.id)
          .eq('status', 'concluido')
          .order('data_hora_encerramento', {
            ascending: false,
          })
          .limit(50),
        'Carregar histórico'
      );

      setAtendimentoHistory(data || []);
    } catch (error) {
      console.error(
        '[loadHistory] Erro ao carregar histórico:',
        error
      );
    }
  }, [equipe?.id]);

  // ====================================================
  // INICIALIZAÇÃO E REALTIME
  // ====================================================

  useEffect(() => {
    if (!user || !equipe || !isSupabaseConfigured()) {
      setCurrentDespacho(null);
      setPendingDespacho(null);
      setLoading(false);
      return;
    }

    void loadDespachos();
    void loadHistory();

    const subscription = supabase
      .channel(`despachos-${equipe.id}`)

      // Alterações nos despachos desta equipe.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'despachos_ocorrencias',
          filter: `equipe_id=eq.${equipe.id}`,
        },
        async (payload) => {
          console.log(
            '[Realtime] Alteração no despacho:',
            payload.eventType,
            payload.new
          );

          await loadDespachos();
        }
      )

      // Alterações no status das ocorrências.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ocorrencias',
        },
        async (payload) => {
          console.log(
            '[Realtime] Alteração na ocorrência:',
            payload.new
          );

          await loadDespachos();
        }
      )

      .subscribe((status) => {
        console.log(
          '[Realtime] Status da assinatura:',
          status
        );
      });

    return () => {
      void supabase.removeChannel(subscription);
    };
  }, [
    user?.id,
    equipe?.id,
    loadDespachos,
    loadHistory,
  ]);

  // ====================================================
  // ACEITAR DESPACHO
  // ====================================================

  const acceptDespacho = async (despachoId: string) => {
    if (!equipe) {
      throw new Error('Equipe não encontrada.');
    }

    setLoading(true);

    try {
      const despacho = await verificarResultado(
        supabase
          .from('despachos_ocorrencias')
          .update({
            status: STATUS_DESPACHO.ACEITA,
            respondido_em: new Date().toISOString(),
          })
          .eq('id', despachoId)
          .eq('equipe_id', equipe.id)
          .eq('status', STATUS_DESPACHO.OFERTADA)
          .select('*')
          .maybeSingle(),
        'Aceitar despacho'
      );

      if (!despacho) {
        throw new Error(
          'O despacho não foi atualizado. Verifique se ainda está ofertado e se a equipe tem permissão.'
        );
      }

      // Verificar se já existe atendimento para a ocorrência.
      // Usamos uma lista para não falhar se houver duplicidade.
      const existingAttdRows = await verificarResultado(
        supabase
          .from('atendimentos')
          .select('id')
          .eq('ocorrencia_id', despacho.ocorrencia_id)
          .eq('equipe_id', equipe.id)
          .order('created_at', { ascending: false })
          .limit(1),
        'Verificar atendimento existente'
      );

      const existingAttd = (existingAttdRows ?? [])[0] ?? null;

      // Criar atendimento somente se não existir.
      if (!existingAttd) {
        await verificarResultado(
          supabase
            .from('atendimentos')
            .insert({
              ocorrencia_id: despacho.ocorrencia_id,
              equipe_id: equipe.id,
              data_hora_aceite: new Date().toISOString(),
              status: 'em_andamento',
            }),
          'Criar atendimento'
        );
      }

      await loadDespachos();

      console.log(
        '[acceptDespacho] Aceite concluído:',
        despachoId
      );
    } catch (error: any) {
      console.error('[acceptDespacho] Erro:', error);

      showAlert(
        'Erro ao aceitar',
        error?.message ||
          'Não foi possível aceitar a ocorrência.'
      );

      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ====================================================
  // RECUSAR DESPACHO
  // ====================================================

  const rejectDespacho = async (despachoId: string) => {
    if (!equipe) {
      return;
    }

    try {
      await verificarResultado(
        supabase
          .from('despachos_ocorrencias')
          .update({
            status: STATUS_DESPACHO.RECUSADA,
            respondido_em: new Date().toISOString(),
          })
          .eq('id', despachoId)
          .eq('equipe_id', equipe.id)
          .eq('status', STATUS_DESPACHO.OFERTADA),
        'Recusar despacho'
      );

      setPendingDespacho(null);

      await loadDespachos();
    } catch (error: any) {
      console.error('[rejectDespacho] Erro:', error);

      showAlert(
        'Erro ao recusar',
        error?.message ||
          'Não foi possível recusar a ocorrência.'
      );

      throw error;
    }
  };

  // ====================================================
  // EXECUTAR AÇÕES DO ATENDIMENTO
  // ====================================================

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
    if (!equipe) {
      throw new Error('Equipe não encontrada.');
    }

    const despachoAntesDaAcao = currentDespacho;

    if (!despachoAntesDaAcao) {
      throw new Error(
        'Nenhum despacho ativo foi encontrado.'
      );
    }

    if (
      despachoAntesDaAcao.ocorrencia?.id !== ocorrenciaId
    ) {
      throw new Error(
        'A ocorrência selecionada não corresponde ao despacho atual.'
      );
    }

    setLoading(true);

    try {
      const now = new Date().toISOString();

      const atendimentoId =
        despachoAntesDaAcao.atendimento?.id;

      console.log('[executarAcao] Iniciando:', {
        acao,
        ocorrenciaId,
        equipeId: equipe.id,
        despachoId: despachoAntesDaAcao.id,
        atendimentoId: atendimentoId ?? null,
      });

      switch (acao) {
        // ---------------------------------------------
        // SAIR PARA O LOCAL
        // ---------------------------------------------

        case ACOES_ATENDIMENTO.SAIR: {
          if (!atendimentoId) {
            throw new Error(
              'Não existe atendimento vinculado a esta ocorrência.'
            );
          }

          const atendimentoAtualizado =
            await verificarResultado(
              supabase
                .from('atendimentos')
                .update({
                  data_hora_saida: now,
                })
                .eq('id', atendimentoId)
                .eq('ocorrencia_id', ocorrenciaId)
                .eq('equipe_id', equipe.id)
                .select('id')
                .maybeSingle(),
              'Registrar saída da equipe'
            );

          if (!atendimentoAtualizado) {
            throw new Error(
              'O atendimento não foi atualizado. Verifique as permissões do Supabase.'
            );
          }

          const ocorrenciaAtualizada =
            await verificarResultado(
              supabase
                .from('ocorrencias')
                .update({
                  status:
                    STATUS_OCORRENCIA.EQUIPE_EM_DESLOCAMENTO,
                })
                .eq('id', ocorrenciaId)
                .select('id, status')
                .maybeSingle(),
              'Atualizar status da ocorrência'
            );

          if (!ocorrenciaAtualizada) {
            throw new Error(
              'A ocorrência não foi atualizada. Verifique as permissões do Supabase.'
            );
          }

          const equipeAtualizada =
            await verificarResultado(
              supabase
                .from('equipes')
                .update({
                  status: STATUS_EQUIPE.EM_DESLOCAMENTO,
                })
                .eq('id', equipe.id)
                .select('id, status')
                .maybeSingle(),
              'Atualizar status da equipe'
            );

          if (!equipeAtualizada) {
            throw new Error(
              'A equipe não foi atualizada. Verifique as permissões do Supabase.'
            );
          }

          console.log(
            '[SAIR] Deslocamento iniciado:',
            equipeAtualizada
          );

          break;
        }

        // ---------------------------------------------
        // CHEGAR AO LOCAL
        // ---------------------------------------------

        case ACOES_ATENDIMENTO.CHEGAR: {
          if (!atendimentoId) {
            throw new Error('Atendimento não encontrado.');
          }

          const atendimento = await verificarResultado(
            supabase
              .from('atendimentos')
              .update({
                data_hora_chegada: now,
              })
              .eq('id', atendimentoId)
              .eq('equipe_id', equipe.id)
              .select('id')
              .maybeSingle(),
            'Registrar chegada'
          );

          if (!atendimento) {
            throw new Error(
              'Não foi possível registrar a chegada.'
            );
          }

          const ocorrencia = await verificarResultado(
            supabase
              .from('ocorrencias')
              .update({
                status: STATUS_OCORRENCIA.EQUIPE_NO_LOCAL,
              })
              .eq('id', ocorrenciaId)
              .select('id')
              .maybeSingle(),
            'Atualizar ocorrência para equipe no local'
          );

          if (!ocorrencia) {
            throw new Error(
              'A ocorrência não foi atualizada.'
            );
          }

          const equipeAtualizada =
            await verificarResultado(
              supabase
                .from('equipes')
                .update({
                  status: STATUS_EQUIPE.NO_LOCAL,
                })
                .eq('id', equipe.id)
                .select('id')
                .maybeSingle(),
              'Atualizar equipe para no local'
            );

          if (!equipeAtualizada) {
            throw new Error(
              'Não foi possível atualizar o status da equipe.'
            );
          }

          break;
        }

        // ---------------------------------------------
        // INICIAR DIAGNÓSTICO
        // ---------------------------------------------

        case ACOES_ATENDIMENTO.INICIAR_DIAGNOSTICO: {
          await verificarResultado(
            supabase
              .from('atendimentos')
              .update({
                data_hora_inicio_diagnostico: now,
              })
              .eq('ocorrencia_id', ocorrenciaId)
              .eq('equipe_id', equipe.id),
            'Iniciar diagnóstico'
          );

          await verificarResultado(
            supabase
              .from('ocorrencias')
              .update({
                status: STATUS_OCORRENCIA.DIAGNOSTICO,
              })
              .eq('id', ocorrenciaId),
            'Atualizar status para diagnóstico'
          );

          break;
        }

        // ---------------------------------------------
        // REGISTRAR DIAGNÓSTICO
        // ---------------------------------------------

        case ACOES_ATENDIMENTO.REGISTRAR_DIAGNOSTICO: {
          await verificarResultado(
            supabase
              .from('diagnosticos')
              .insert({
                ocorrencia_id: ocorrenciaId,
                atendimento_id: atendimentoId || null,
                tipo_problema:
                  dadosExtra?.tipo_problema || null,
                descricao: dadosExtra?.descricao || null,
                gravidade:
                  (dadosExtra?.gravidade as any) || null,
                servico_necessario:
                  dadosExtra?.servico_necessario || null,
                material_necessario:
                  dadosExtra?.material_necessario || null,
              }),
            'Registrar diagnóstico'
          );

          await verificarResultado(
            supabase
              .from('atendimentos')
              .update({
                data_hora_fim_diagnostico: now,
              })
              .eq('ocorrencia_id', ocorrenciaId)
              .eq('equipe_id', equipe.id),
            'Finalizar diagnóstico'
          );

          break;
        }

        // ---------------------------------------------
        // INICIAR REPARO
        // ---------------------------------------------

        case ACOES_ATENDIMENTO.INICIAR_REPARO: {
          await verificarResultado(
            supabase
              .from('atendimentos')
              .update({
                data_hora_inicio_reparo: now,
              })
              .eq('ocorrencia_id', ocorrenciaId)
              .eq('equipe_id', equipe.id),
            'Iniciar reparo'
          );

          await verificarResultado(
            supabase
              .from('ocorrencias')
              .update({
                status: STATUS_OCORRENCIA.EM_REPARO,
              })
              .eq('id', ocorrenciaId),
            'Atualizar ocorrência para em reparo'
          );

          break;
        }

        // ---------------------------------------------
        // FINALIZAR REPARO
        // ---------------------------------------------

        case ACOES_ATENDIMENTO.FINALIZAR_REPARO: {
          await verificarResultado(
            supabase
              .from('atendimentos')
              .update({
                data_hora_fim_reparo: now,
              })
              .eq('ocorrencia_id', ocorrenciaId)
              .eq('equipe_id', equipe.id),
            'Finalizar reparo'
          );

          break;
        }

        // ---------------------------------------------
        // REGISTRAR TESTE DE REDE
        // ---------------------------------------------

        case ACOES_ATENDIMENTO.REGISTRAR_TESTE: {
          await verificarResultado(
            supabase
              .from('testes')
              .insert({
                ocorrencia_id: ocorrenciaId,
                atendimento_id: atendimentoId || null,
                tipo_teste: dadosExtra?.tipo_teste || null,
                resultado: dadosExtra?.resultado || null,
              }),
            'Registrar teste'
          );

          await verificarResultado(
            supabase
              .from('atendimentos')
              .update({
                data_hora_inicio_teste: now,
                data_hora_fim_teste: now,
              })
              .eq('ocorrencia_id', ocorrenciaId)
              .eq('equipe_id', equipe.id),
            'Atualizar datas do teste'
          );

          await verificarResultado(
            supabase
              .from('ocorrencias')
              .update({
                status: STATUS_OCORRENCIA.EM_TESTE,
              })
              .eq('id', ocorrenciaId),
            'Atualizar ocorrência para em teste'
          );

          break;
        }

        // ---------------------------------------------
        // REGISTRAR RELIGAÇÃO
        // ---------------------------------------------

        case ACOES_ATENDIMENTO.RELIGAR: {
          await verificarResultado(
            supabase
              .from('atendimentos')
              .update({
                data_hora_religacao: now,
              })
              .eq('ocorrencia_id', ocorrenciaId)
              .eq('equipe_id', equipe.id),
            'Registrar religação'
          );

          await verificarResultado(
            supabase
              .from('ocorrencias')
              .update({
                status:
                  STATUS_OCORRENCIA.AGUARDANDO_RELIGACAO,
              })
              .eq('id', ocorrenciaId),
            'Atualizar ocorrência para aguardando religação'
          );

          break;
        }

        // ---------------------------------------------
        // ENCERRAR ATENDIMENTO
        // ---------------------------------------------

        case ACOES_ATENDIMENTO.ENCERRAR: {
          if (!atendimentoId) {
            throw new Error(
              'Não existe atendimento vinculado à ocorrência.'
            );
          }

          // 1. Finalizar atendimento.
          const atendimentoEncerrado =
            await verificarResultado(
              supabase
                .from('atendimentos')
                .update({
                  data_hora_restabelecimento: now,
                  data_hora_encerramento: now,
                  status: 'concluido',
                })
                .eq('id', atendimentoId)
                .eq('ocorrencia_id', ocorrenciaId)
                .eq('equipe_id', equipe.id)
                .select('id, status')
                .maybeSingle(),
              'Encerrar atendimento'
            );

          if (!atendimentoEncerrado) {
            throw new Error(
              'O atendimento não foi encerrado. Verifique as permissões do Supabase.'
            );
          }

          // 2. Marcar ocorrência como restabelecida.
          const ocorrenciaEncerrada =
            await verificarResultado(
              supabase
                .from('ocorrencias')
                .update({
                  status: STATUS_OCORRENCIA.RESTABELECIDA,
                  data_hora_encerramento: now,
                })
                .eq('id', ocorrenciaId)
                .select('id, status')
                .maybeSingle(),
              'Restabelecer ocorrência'
            );

          if (!ocorrenciaEncerrada) {
            throw new Error(
              'O atendimento foi concluído, mas a ocorrência não foi atualizada. Verifique as permissões do Supabase.'
            );
          }

          // 3. Liberar a equipe.
          const equipeLiberada =
            await verificarResultado(
              supabase
                .from('equipes')
                .update({
                  status: STATUS_EQUIPE.DISPONIVEL,
                })
                .eq('id', equipe.id)
                .select('id, status')
                .maybeSingle(),
              'Liberar equipe'
            );

          if (!equipeLiberada) {
            throw new Error(
              'A ocorrência foi encerrada, mas a equipe não foi liberada. Verifique as permissões do Supabase.'
            );
          }

          // 4. Limpar a ocorrência associada à localização.
          await verificarResultado(
            supabase
              .from('localizacoes_equipes_atual')
              .update({
                ocorrencia_atual_id: null,
                updated_at: now,
              })
              .eq('equipe_id', equipe.id),
            'Limpar ocorrência atual da localização'
          );

          // 5. Remover o card da interface imediatamente.
          setCurrentDespacho(null);

          console.log('[ENCERRAR] Atendimento concluído:', {
            atendimentoId: atendimentoEncerrado.id,
            ocorrenciaId: ocorrenciaEncerrada.id,
            statusOcorrencia: ocorrenciaEncerrada.status,
            equipeId: equipeLiberada.id,
            statusEquipe: equipeLiberada.status,
          });

          break;
        }

        default: {
          throw new Error(`Ação não reconhecida: ${acao}`);
        }
      }

      await loadDespachos();

      if (acao === ACOES_ATENDIMENTO.ENCERRAR) {
        await loadHistory();
      }

      console.log('[executarAcao] Ação concluída:', acao);
    } catch (error: any) {
      console.error('[executarAcao] Falha:', {
        acao,
        ocorrenciaId,
        equipeId: equipe.id,
        message: error?.message,
        error,
      });

      showAlert(
        'Erro ao executar ação',
        error?.message ||
          'Não foi possível executar a ação.'
      );

      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ====================================================
  // RETORNO DO HOOK
  // ====================================================

  return {
    currentDespacho,
    pendingDespacho,
    atendimentoHistory,
    loading,
    acceptDespacho,
    rejectDespacho,
    executarAcao,

    refreshDespachos: async () => {
      await Promise.all([
        loadDespachos(),
        loadHistory(),
      ]);
    },
  };
}