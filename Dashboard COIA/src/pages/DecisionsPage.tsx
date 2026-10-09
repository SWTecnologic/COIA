import { useState, useMemo } from 'react';
import { GitMerge, Flag, Truck, Clock, Filter, ListChecks } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { shortId, timeAgo, formatDistance, formatTime } from '@/lib/utils';
import type { IaCorrelacao, IaPrioridade, IaRecomendacaoEquipe, IaPrevisao } from '@/types';

type DecisionType = 'todos' | 'correlacao' | 'prioridade' | 'despacho' | 'previsao';

interface DecisionItem {
  id: string;
  type: 'correlacao' | 'prioridade' | 'despacho' | 'previsao';
  timestamp: string | null;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export function DecisionsPage() {
  const [filter, setFilter] = useState<DecisionType>('todos');

  const { data: correlacoes } = useRealtimeTable<IaCorrelacao>({ table: 'ia_correlacoes', limit: 200 });
  const { data: prioridades } = useRealtimeTable<IaPrioridade>({ table: 'ia_prioridades', limit: 200 });
  const { data: despachos } = useRealtimeTable<IaRecomendacaoEquipe>({ table: 'ia_recomendacoes_equipes', limit: 200 });
  const { data: previsoes } = useRealtimeTable<IaPrevisao>({ table: 'ia_previsoes', limit: 200 });

  const allDecisions = useMemo<DecisionItem[]>(() => {
    const items: DecisionItem[] = [];

    correlacoes.forEach((c) => {
      items.push({
        id: `corr-${c.id}`,
        type: 'correlacao',
        timestamp: c.criado_em,
        title: `${shortId(c.chamado_id, 'CH-')} → ${shortId(c.ocorrencia_id, 'OC-')}`,
        description: `Correlação identificada${c.distancia_m !== null ? ` · ${formatDistance(c.distancia_m)}` : ''}${c.score !== null ? ` · score ${c.score.toFixed(2)}` : ''}${c.motivo ? ` · ${c.motivo}` : ''}`,
        icon: <GitMerge className="h-4 w-4 text-white" />,
        color: 'bg-blue-500',
      });
    });

    prioridades.forEach((p) => {
      items.push({
        id: `prio-${p.id}`,
        type: 'prioridade',
        timestamp: p.criado_em,
        title: `${shortId(p.ocorrencia_id, 'OC-')} → ${p.prioridade_final ?? '—'}`,
        description: p.motivo ?? 'Prioridade definida pelo motor de IA',
        icon: <Flag className="h-4 w-4 text-white" />,
        color: 'bg-amber-500',
      });
    });

    despachos.forEach((d) => {
      items.push({
        id: `desp-${d.id}`,
        type: 'despacho',
        timestamp: d.criado_em,
        title: `${shortId(d.ocorrencia_id, 'OC-')} → ${d.equipe_id ?? 'equipe'}`,
        description: `Equipe sugerida${d.distancia_km !== null ? ` · ${d.distancia_km.toFixed(1)}km` : ''}${d.eta_minutos !== null ? ` · ETA ${d.eta_minutos}min` : ''}${d.pontuacao !== null ? ` · pontuação ${d.pontuacao.toFixed(1)}` : ''}`,
        icon: <Truck className="h-4 w-4 text-white" />,
        color: 'bg-indigo-500',
      });
    });

    previsoes.forEach((p) => {
      items.push({
        id: `prev-${p.id}`,
        type: 'previsao',
        timestamp: p.criado_em,
        title: `${shortId(p.ocorrencia_id, 'OC-')} → ${formatTime(p.horario_estimado)}`,
        description: `Previsão de restabelecimento${p.tempo_estimado_min !== null ? ` · ${p.tempo_estimado_min}min` : ''}${p.confianca !== null ? ` · confiança ${Math.round(p.confianca * 100)}%` : ''}${p.tipo ? ` · ${p.tipo}` : ''}`,
        icon: <Clock className="h-4 w-4 text-white" />,
        color: 'bg-teal-500',
      });
    });

    return items.sort((a, b) => {
      const da = new Date(a.timestamp ?? 0).getTime();
      const db = new Date(b.timestamp ?? 0).getTime();
      return db - da;
    });
  }, [correlacoes, prioridades, despachos, previsoes]);

  const filtered = filter === 'todos' ? allDecisions : allDecisions.filter((d) => d.type === filter);

  const filterOptions: { value: DecisionType; label: string; count: number }[] = [
    { value: 'todos', label: 'Todos', count: allDecisions.length },
    { value: 'correlacao', label: 'Correlações', count: allDecisions.filter((d) => d.type === 'correlacao').length },
    { value: 'prioridade', label: 'Prioridades', count: allDecisions.filter((d) => d.type === 'prioridade').length },
    { value: 'despacho', label: 'Despachos', count: allDecisions.filter((d) => d.type === 'despacho').length },
    { value: 'previsao', label: 'Previsões', count: allDecisions.filter((d) => d.type === 'previsao').length },
  ];

  return (
    <div>
      <PageHeader title="Feed de Decisões" description="Todas as decisões do motor de IA em ordem cronológica" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Filtrar:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === opt.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {opt.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  filter === opt.value ? 'bg-white/20' : 'bg-slate-100'
                }`}
              >
                {opt.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      {filtered.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

          <div className="space-y-3">
            {filtered.map((item) => (
              <div key={item.id} className="relative flex items-start gap-4 pl-0">
                <div className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${item.color} shadow-sm`}>
                  {item.icon}
                </div>
                <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-700">{item.title}</span>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(item.timestamp)}</span>
                  </div>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <EmptyState
            icon={<ListChecks className="h-7 w-7" />}
            title="Nenhuma decisão registrada"
            message="O motor de IA ainda não tomou nenhuma decisão. Assim que o processamento começar, todas as decisões aparecerão aqui em tempo real."
          />
        </div>
      )}
    </div>
  );
}
