import { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle, BarChart3, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { EmptyState } from '@/components/EmptyState';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { formatDateTime } from '@/lib/utils';
import type { HistoricoOperacional, IaAnalise } from '@/types';

type PeriodFilter = 'hoje' | '7d' | '30d';
type ModuleFilter = 'todos' | 'correlacao' | 'prioridade' | 'despacho' | 'previsao';

const moduleColors: Record<string, string> = {
  correlacao: '#3b82f6',
  prioridade: '#f59e0b',
  despacho: '#6366f1',
  previsao: '#14b8a6',
};

function getPeriodDays(period: PeriodFilter): number {
  switch (period) {
    case 'hoje': return 0;
    case '7d': return 7;
    case '30d': return 30;
  }
}

function isWithinPeriod(dateStr: string | null, period: PeriodFilter): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  if (period === 'hoje') {
    return date.toDateString() === now.toDateString();
  }
  const days = getPeriodDays(period);
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return date >= cutoff;
}

interface ErrorRow {
  id: string;
  when: string | null;
  module: string;
  entity: string;
  message: string;
  result: string;
}

export function ErrorsPage() {
  const [period, setPeriod] = useState<PeriodFilter>('hoje');
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('todos');

  // historico_operacional → coluna de ordenação é `data_hora`
  const { data: historico } = useRealtimeTable<HistoricoOperacional>({
    table: 'historico_operacional',
    orderBy: 'data_hora',
    limit: 500,
  });

  // ia_analises → coluna de ordenação é `criado_em`
  const { data: analises } = useRealtimeTable<IaAnalise>({
    table: 'ia_analises',
    orderBy: 'criado_em',
    limit: 500,
  });

  const { errorRows, moduleCounts, totalErrors, successRate } = useMemo(() => {
    const rows: ErrorRow[] = [];

    // Falhas do histórico — campo de data é `data_hora`
    historico
      .filter((h) => h.resultado === 'falha')
      .forEach((h) => {
        rows.push({
          id: h.id,
          when: h.data_hora,
          module: h.entidade ?? 'desconhecido',
          entity: h.acao ?? '—',
          message: h.observacoes ?? h.resultado ?? '—',
          result: 'Falha',
        });
      });

    // Análises duvidosas (confiança < 0.5) — campo de data é `criado_em`
    analises
      .filter((a) => a.confianca !== null && a.confianca < 0.5)
      .forEach((a) => {
        rows.push({
          id: a.id,
          when: a.criado_em,
          module: a.tipo_analise ?? 'desconhecido',
          entity: a.entidade ?? '—',
          message: a.justificativa ?? 'Confiança baixa',
          result: 'Duvidosa',
        });
      });

    // Filtro por período
    const periodRows = rows.filter((r) => isWithinPeriod(r.when, period));

    // Contagem por módulo pro gráfico
    const counts: Record<string, number> = {};
    periodRows.forEach((r) => {
      const mod = r.module in moduleColors ? r.module : 'outros';
      counts[mod] = (counts[mod] ?? 0) + 1;
    });

    // Filtro por módulo
    const moduleRows = moduleFilter === 'todos'
      ? periodRows
      : periodRows.filter((r) => r.module === moduleFilter);

    // Taxa de sucesso — campo de data é `data_hora`
    const totalHistorico = historico.filter((h) => isWithinPeriod(h.data_hora, period));
    const failures = totalHistorico.filter((h) => h.resultado === 'falha').length;
    const success = totalHistorico.filter((h) => h.resultado === 'sucesso').length;
    const total = success + failures;
    const rate = total > 0 ? (success / total) * 100 : 100;

    return {
      errorRows: moduleRows.sort((a, b) => {
        const da = new Date(a.when ?? 0).getTime();
        const db = new Date(b.when ?? 0).getTime();
        return db - da;
      }),
      moduleCounts: counts,
      totalErrors: periodRows.length,
      successRate: rate,
    };
  }, [historico, analises, period, moduleFilter]);

  const chartData = Object.entries(moduleCounts).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count,
    fill: moduleColors[name] ?? '#94a3b8',
  }));

  const hasData = errorRows.length > 0 || totalErrors > 0;

  return (
    <div>
      <PageHeader title="Erros e Falhas da IA" description="Monitoramento de falhas e análises duvidosas do motor" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Total de erros"
          value={totalErrors}
          color={totalErrors > 0 ? 'red' : 'green'}
          subtitle={period === 'hoje' ? 'Hoje' : period === '7d' ? '7 dias' : '30 dias'}
        />
        <KpiCard
          icon={<CheckCircle className="h-5 w-5" />}
          label="Taxa de sucesso"
          value={`${successRate.toFixed(1)}%`}
          color={successRate > 90 ? 'green' : successRate > 70 ? 'amber' : 'red'}
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Erros por módulo"
          value={chartData.length}
          color="violet"
          subtitle="Módulos afetados"
        />
      </div>

      {chartData.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Erros por Módulo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Módulo:</span>
        </div>
        <div className="flex gap-1.5">
          {(['todos', 'correlacao', 'prioridade', 'despacho', 'previsao'] as ModuleFilter[]).map((m) => (
            <button
              key={m}
              onClick={() => setModuleFilter(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                moduleFilter === m
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {m === 'todos' ? 'Todos' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-auto">
          {(['hoje', '7d', '30d'] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                period === p
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {p === 'hoje' ? 'Hoje' : p === '7d' ? '7 dias' : '30 dias'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {hasData ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Quando</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Módulo</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Entidade</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Mensagem</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {errorRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(row.when)}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: (moduleColors[row.module] ?? '#94a3b8') + '20',
                          color: moduleColors[row.module] ?? '#64748b',
                        }}
                      >
                        {row.module}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{row.entity}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{row.message}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          row.result === 'Falha'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {row.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<CheckCircle className="h-7 w-7" />}
            title="Nenhum erro encontrado"
            message="Não há falhas ou análises duvidosas no período selecionado. O motor está operando normalmente."
          />
        )}
      </div>
    </div>
  );
}