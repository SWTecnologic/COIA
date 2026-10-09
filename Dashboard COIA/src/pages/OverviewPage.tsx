import { Inbox, GitMerge, Flag, Truck, Clock, Brain, AlertCircle, TrendingUp, Users, Gauge } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Pipeline } from '@/components/Pipeline';
import { KpiCard } from '@/components/KpiCard';
import { EmptyState } from '@/components/EmptyState';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import type { Chamado, Ocorrencia, IaCorrelacao, IaPrioridade, IaRecomendacaoEquipe, IaPrevisao } from '@/types';

export function OverviewPage() {
  const { data: chamados, loading: l1 } = useRealtimeTable<Chamado>({ table: 'chamados', orderBy: 'data_hora', limit: 1000 });
  const { data: ocorrencias, loading: l2 } = useRealtimeTable<Ocorrencia>({ table: 'ocorrencias', orderBy: 'ia_atualizado_em', limit: 1000 });
  const { data: correlacoes, loading: l3 } = useRealtimeTable<IaCorrelacao>({ table: 'ia_correlacoes', limit: 1000 });
  const { data: prioridades, loading: l4 } = useRealtimeTable<IaPrioridade>({ table: 'ia_prioridades', limit: 1000 });
  const { data: despachos, loading: l5 } = useRealtimeTable<IaRecomendacaoEquipe>({ table: 'ia_recomendacoes_equipes', limit: 1000 });
  const { data: previsoes, loading: l6 } = useRealtimeTable<IaPrevisao>({ table: 'ia_previsoes', limit: 1000 });

  const loading = l1 || l2 || l3 || l4 || l5 || l6;

  const chamadosSemOcorrencia = chamados.filter((c) => !c.ocorrencia_id).length;
  const ocorrenciasComIA = ocorrencias.filter((o) => o.ia_prioridade_final !== null).length;
  const equipesSugeridas = despachos.length;

  const confiancas = previsoes
    .map((p) => p.confianca)
    .filter((c): c is number => c !== null && c !== undefined);
  const confiancaMedia = confiancas.length > 0
    ? confiancas.reduce((a, b) => a + b, 0) / confiancas.length
    : null;

  const counts = {
    chamados: chamados.length,
    correlacoes: correlacoes.length,
    prioridades: prioridades.length,
    despachos: despachos.length,
    previsoes: previsoes.length,
    ocorrencias: ocorrenciasComIA,
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Overview" description="Visão geral do motor de IA em tempo real" />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-violet-200 border-t-violet-600" style={{ borderWidth: '3px' }} />
        </div>
      </div>
    );
  }

  const hasAnyData = chamados.length > 0 || ocorrencias.length > 0 || correlacoes.length > 0;

  return (
    <div>
      <PageHeader title="Overview" description="Visão geral do motor de IA em tempo real" />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Pipeline do Motor</h3>
        <Pipeline counts={counts} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Chamados sem ocorrência"
          value={chamadosSemOcorrencia}
          color={chamadosSemOcorrencia > 0 ? 'amber' : 'violet'}
          subtitle={chamadosSemOcorrencia > 0 ? 'Atenção' : 'Em dia'}
        />
        <KpiCard
          icon={<Brain className="h-5 w-5" />}
          label="Ocorrências com IA"
          value={ocorrenciasComIA}
          color="blue"
          subtitle="Processadas"
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Equipes sugeridas"
          value={equipesSugeridas}
          color="indigo"
          subtitle="Despachos"
        />
        <KpiCard
          icon={<Gauge className="h-5 w-5" />}
          label="Confiança média (previsões)"
          value={confiancaMedia !== null ? `${Math.round(confiancaMedia * 100)}%` : '—'}
          color={confiancaMedia !== null && confiancaMedia > 0.7 ? 'green' : 'amber'}
          subtitle={confiancaMedia !== null && confiancaMedia > 0.7 ? 'Alta' : 'Baixa'}
        />
      </div>

      {!hasAnyData && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <EmptyState
            icon={<TrendingUp className="h-7 w-7" />}
            title="Aguardando dados do motor"
            message="O motor de IA ainda não processou nenhum registro. Assim que os dados chegarem ao Supabase, eles aparecerão aqui automaticamente."
          />
        </div>
      )}
    </div>
  );
}
