import { PageHeader } from '@/components/PageHeader';
import { Pipeline } from '@/components/Pipeline';
import { EmptyState } from '@/components/EmptyState';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { shortId, formatDistance, timeAgo, formatTime } from '@/lib/utils';
import type { Chamado, Ocorrencia, IaCorrelacao, IaPrioridade, IaRecomendacaoEquipe, IaPrevisao } from '@/types';
import { GitMerge, Flag, Truck, Clock, Inbox } from 'lucide-react';

interface ColumnSectionProps {
  icon: React.ReactNode;
  title: string;
  accentColor: string;
  children: React.ReactNode;
  hasData: boolean;
}

function ColumnSection({ icon, title, accentColor, children, hasData }: ColumnSectionProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentColor}`}>
          {icon}
        </div>
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      </div>
      <div className="flex-1 overflow-y-auto max-h-96">
        {hasData ? children : (
          <EmptyState title="Sem registros" message="Nenhum dado neste módulo ainda." />
        )}
      </div>
    </div>
  );
}

export function PipelinePage() {
  const { data: chamados } = useRealtimeTable<Chamado>({ table: 'chamados', orderBy: 'data_hora', limit: 1000 });
  const { data: ocorrencias } = useRealtimeTable<Ocorrencia>({ table: 'ocorrencias', orderBy: 'ia_atualizado_em', limit: 1000 });
  const { data: correlacoes } = useRealtimeTable<IaCorrelacao>({ table: 'ia_correlacoes', limit: 10 });
  const { data: prioridades } = useRealtimeTable<IaPrioridade>({ table: 'ia_prioridades', limit: 10 });
  const { data: despachos } = useRealtimeTable<IaRecomendacaoEquipe>({ table: 'ia_recomendacoes_equipes', limit: 10 });
  const { data: previsoes } = useRealtimeTable<IaPrevisao>({ table: 'ia_previsoes', limit: 10 });

  const ocorrenciasComIA = ocorrencias.filter((o) => o.ia_prioridade_final !== null).length;

  const counts = {
    chamados: chamados.length,
    correlacoes: correlacoes.length,
    prioridades: prioridades.length,
    despachos: despachos.length,
    previsoes: previsoes.length,
    ocorrencias: ocorrenciasComIA,
  };

  const rowHover = 'hover:bg-slate-50 transition-colors';

  return (
    <div>
      <PageHeader title="Pipeline Detalhado" description="Fluxo completo de processamento do motor de IA" />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Pipeline do Motor</h3>
        <Pipeline counts={counts} size="lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Correlações */}
        <ColumnSection
          icon={<GitMerge className="h-4 w-4 text-white" />}
          title="Últimas Correlações"
          accentColor="bg-blue-500"
          hasData={correlacoes.length > 0}
        >
          <div className="divide-y divide-slate-50">
            {correlacoes.map((c) => (
              <div key={c.id} className={`px-4 py-3 ${rowHover}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">
                    {shortId(c.chamado_id, 'CH-')} → {shortId(c.ocorrencia_id, 'OC-')}
                  </span>
                  <span className="text-xs text-slate-400">{timeAgo(c.criado_em)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{formatDistance(c.distancia_m)}</span>
                  {c.score !== null && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-600">
                      score {c.score.toFixed(2)}
                    </span>
                  )}
                </div>
                {c.motivo && <p className="text-xs text-slate-400 mt-1 truncate">{c.motivo}</p>}
              </div>
            ))}
          </div>
        </ColumnSection>

        {/* Prioridades */}
        <ColumnSection
          icon={<Flag className="h-4 w-4 text-white" />}
          title="Últimas Prioridades"
          accentColor="bg-amber-500"
          hasData={prioridades.length > 0}
        >
          <div className="divide-y divide-slate-50">
            {prioridades.map((p) => (
              <div key={p.id} className={`px-4 py-3 ${rowHover}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">{shortId(p.ocorrencia_id, 'OC-')}</span>
                  <span className="text-xs text-slate-400">{timeAgo(p.criado_em)}</span>
                </div>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    p.prioridade_final === 'urgente'
                      ? 'bg-red-50 text-red-600'
                      : p.prioridade_final === 'alta'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {p.prioridade_final ?? '—'}
                </span>
                {p.motivo && <p className="text-xs text-slate-400 mt-1 truncate">{p.motivo}</p>}
              </div>
            ))}
          </div>
        </ColumnSection>

        {/* Despachos */}
        <ColumnSection
          icon={<Truck className="h-4 w-4 text-white" />}
          title="Últimos Despachos"
          accentColor="bg-indigo-500"
          hasData={despachos.length > 0}
        >
          <div className="divide-y divide-slate-50">
            {despachos.map((d) => (
              <div key={d.id} className={`px-4 py-3 ${rowHover}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">
                    {shortId(d.ocorrencia_id, 'OC-')} → {d.equipe_id ?? '—'}
                  </span>
                  <span className="text-xs text-slate-400">{timeAgo(d.criado_em)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {d.distancia_km !== null && <span>{d.distancia_km.toFixed(1)}km</span>}
                  {d.eta_minutos !== null && <span>ETA {d.eta_minutos}min</span>}
                  {d.pontuacao !== null && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600">
                      pt {d.pontuacao.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ColumnSection>

        {/* Previsões */}
        <ColumnSection
          icon={<Clock className="h-4 w-4 text-white" />}
          title="Últimas Previsões"
          accentColor="bg-teal-500"
          hasData={previsoes.length > 0}
        >
          <div className="divide-y divide-slate-50">
            {previsoes.map((p) => (
              <div key={p.id} className={`px-4 py-3 ${rowHover}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">{shortId(p.ocorrencia_id, 'OC-')}</span>
                  <span className="text-xs text-slate-400">{timeAgo(p.criado_em)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{formatTime(p.horario_estimado)}</span>
                  {p.tempo_estimado_min !== null && <span>{p.tempo_estimado_min}min</span>}
                  {p.confianca !== null && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        p.confianca > 0.7
                          ? 'bg-green-50 text-green-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {Math.round(p.confianca * 100)}%
                    </span>
                  )}
                </div>
                {p.tipo && <p className="text-xs text-slate-400 mt-1">{p.tipo}</p>}
              </div>
            ))}
          </div>
        </ColumnSection>
      </div>

      {chamados.length === 0 && ocorrencias.length === 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <EmptyState
            icon={<Inbox className="h-7 w-7" />}
            title="Pipeline sem dados"
            message="Nenhum registro foi processado pelo motor ainda. Os dados aparecerão aqui automaticamente em tempo real."
          />
        </div>
      )}
    </div>
  );
}
