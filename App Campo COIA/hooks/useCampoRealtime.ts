// hooks/useCampoRealtime.ts
// Mantém a tela do campo SEMPRE atualizada, sem sair/entrar do app:
//  - Supabase Realtime (postgres_changes) em equipes, despachos, pausas,
//    atendimentos e na ocorrência atual;
//  - polling de segurança a cada 10 s (caso o websocket caia);
//  - refetch quando o app volta para primeiro plano;
//  - refetch automático quando uma oferta de despacho expira.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';

const STATUS_FINAIS = ['restabelecida', 'cancelada'];
const POLL_MS = 10_000;

export function useCampoRealtime(equipeId?: string | null) {
  const [pendingDespacho, setPendingDespacho] = useState<any>(null);
  const [currentDespacho, setCurrentDespacho] = useState<any>(null);
  const [equipeStatus, setEquipeStatus] = useState<string | null>(null);
  const [pausaAtiva, setPausaAtiva] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  const mounted = useRef(true);
  const seq = useRef(0);
  const debounceRef = useRef<any>(null);
  const expiraRef = useRef<any>(null);

  const fetchAll = useCallback(async () => {
    if (!equipeId) return;
    const mySeq = ++seq.current;

    try {
      const [equipeRes, pausaRes, ofertasRes, aceitasRes] = await Promise.all([
        supabase.from('equipes').select('status').eq('id', equipeId).maybeSingle(),

        supabase
          .from('pausas_equipes')
          .select('*')
          .eq('equipe_id', equipeId)
          .eq('status', 'em_andamento')
          .maybeSingle(),

        supabase
          .from('despachos_ocorrencias')
          .select('*, ocorrencia:ocorrencias(*)')
          .eq('equipe_id', equipeId)
          .eq('status', 'ofertada')
          .order('enviado_em', { ascending: false })
          .limit(5),

        supabase
          .from('despachos_ocorrencias')
          .select('*, ocorrencia:ocorrencias(*)')
          .eq('equipe_id', equipeId)
          .eq('status', 'aceita')
          .order('respondido_em', { ascending: false })
          .limit(5),
      ]);

      if (!mounted.current || mySeq !== seq.current) return;

      if (equipeRes.data?.status) setEquipeStatus(equipeRes.data.status);
      if (!pausaRes.error) setPausaAtiva(pausaRes.data ?? null);

      // Oferta pendente (ainda não expirada, ocorrência ainda ativa)
      const agora = Date.now();
      const pendente =
        (ofertasRes.data ?? []).find(
          (d: any) =>
            d.ocorrencia &&
            !STATUS_FINAIS.includes(d.ocorrencia.status) &&
            (!d.expira_em || new Date(d.expira_em).getTime() > agora)
        ) ?? null;
      if (!ofertasRes.error) setPendingDespacho(pendente);

      // Agenda refetch no instante em que a oferta expira
      clearTimeout(expiraRef.current);
      if (pendente?.expira_em) {
        const ms = new Date(pendente.expira_em).getTime() - agora + 500;
        if (ms > 0) expiraRef.current = setTimeout(fetchAll, ms);
      }

      // Atendimento em curso (despacho aceito cuja ocorrência não terminou)
      const atual =
        (aceitasRes.data ?? []).find(
          (d: any) => d.ocorrencia && !STATUS_FINAIS.includes(d.ocorrencia.status)
        ) ?? null;

      if (!aceitasRes.error) {
        if (atual) {
          const { data: atendimento } = await supabase
            .from('atendimentos')
            .select('*')
            .eq('ocorrencia_id', atual.ocorrencia_id)
            .eq('equipe_id', equipeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!mounted.current || mySeq !== seq.current) return;
          setCurrentDespacho({ ...atual, atendimento: atendimento ?? null });
        } else {
          setCurrentDespacho(null);
        }
      }
    } catch (e) {
      console.error('[useCampoRealtime] fetchAll:', e);
    }
  }, [equipeId]);

  const agendarRefetch = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchAll, 250);
  }, [fetchAll]);

  // Canal principal da equipe + polling + AppState
  useEffect(() => {
    mounted.current = true;
    if (!equipeId) {
      setPendingDespacho(null);
      setCurrentDespacho(null);
      setPausaAtiva(null);
      return;
    }

    fetchAll();

    const canal = supabase
      .channel(`campo-equipe-${equipeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'equipes', filter: `id=eq.${equipeId}` },
        (payload: any) => {
          if (payload.new?.status) setEquipeStatus(payload.new.status);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'despachos_ocorrencias', filter: `equipe_id=eq.${equipeId}` },
        agendarRefetch
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pausas_equipes', filter: `equipe_id=eq.${equipeId}` },
        agendarRefetch
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'atendimentos', filter: `equipe_id=eq.${equipeId}` },
        agendarRefetch
      )
      .subscribe((status: string) => {
        const ok = status === 'SUBSCRIBED';
        setConnected(ok);
        if (ok) fetchAll(); // (re)conectou: garante que nada se perdeu
      });

    const poll = setInterval(fetchAll, POLL_MS);

    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') fetchAll();
    });

    return () => {
      mounted.current = false;
      clearInterval(poll);
      clearTimeout(debounceRef.current);
      clearTimeout(expiraRef.current);
      appSub.remove();
      supabase.removeChannel(canal);
    };
  }, [equipeId, fetchAll, agendarRefetch]);

  // Canal da ocorrência atual/pendente (status muda pelo dashboard/IA)
  const ocorrenciaId =
    currentDespacho?.ocorrencia?.id ?? pendingDespacho?.ocorrencia?.id ?? null;

  useEffect(() => {
    if (!ocorrenciaId) return;

    const canal = supabase
      .channel(`campo-ocorrencia-${ocorrenciaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ocorrencias', filter: `id=eq.${ocorrenciaId}` },
        agendarRefetch
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [ocorrenciaId, agendarRefetch]);

  return {
    pendingDespacho,
    currentDespacho,
    equipeStatus,
    setEquipeStatus,
    pausaAtiva,
    setPausaAtiva,
    connected,
    refetch: fetchAll,
  };
}