import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell,
} from 'recharts';
import { Brain, Target, TrendingUp, TrendingDown, Minus, Cpu } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { EmptyState } from '@/components/EmptyState';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import type { IaPrevisao, Atendimento } from '@/types';

export function LearningPage() {
  // ia_previsoes → coluna de ordenação é `criado_em`
  const { data: previsoes } = useRealtimeTable<IaPrevisao>({
    table: 'ia_previsoes',
    orderBy: 'criado_em',
    limit: 500,
  });

  // atendimentos → coluna de ordenação é `created_at`
  const { data: atendimentos } = useRealtimeTable<Atendimento>({
    table: 'atendimentos',
    orderBy: 'created_at',
    limit: 500,
  });

  const {
    comparacoes,
    erroMedio,
    pctErroMenor15,
    tendencia,
    lineChartData,
    barChartData,
    modeloVersoes,
  } = useMemo(() => {
    const comparacoesRaw = previsoes
      .map((p) => {
        const atendimento = atendimentos.find(
          (a) => a.ocorrencia_id === p.ocorrencia_id && a.data_hora_restabelecimento
        );
        if (!atendimento || !p.tempo_estimado_min) return null;

        const previsto = new Date(p.criado_em ?? new Date());
        const real = new Date(atendimento.data_hora_restabelecimento!);
        const realMin = Math.abs((real.getTime() - previsto.getTime()) / 60000);
        const erro = Math.abs(realMin - p.tempo_estimado_min);

        return {
          id: p.id,
          ocorrencia_id: p.ocorrencia_id,
          tipo: p.tipo,
          previsto: p.tempo_estimado_min,
          real: Math.round(realMin),
          erro: Math.round(erro),
          modelo_versao: p.modelo_versao,
          data: p.criado_em,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => new Date(b.data ?? 0).getTime() - new Date(a.data ?? 0).getTime());

    const erros = comparacoesRaw.map((c) => c.erro);
    const erroMedioVal = erros.length > 0 ? erros.reduce((a, b) => a + b, 0) / erros.length : 0;
    const pctMenor15 = erros.length > 0 ? (erros.filter((e) => e < 15).length / erros.length) * 100 : 0;

    let tendenciaVal: 'melhorando' | 'piorando' | 'estavel' = 'estavel';
    if (comparacoesRaw.length >= 4) {
      const sorted = [...comparacoesRaw].reverse();
      const mid = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, mid).map((c) => c.erro);
      const secondHalf = sorted.slice(mid).map((c) => c.erro);
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const diff = avgFirst - avgSecond;
      if (diff > 3) tendenciaVal = 'melhorando';
      else if (diff < -3) tendenciaVal = 'piorando';
    }

    const byDate: Record<string, { sum: number; count: number }> = {};
    comparacoesRaw.forEach((c) => {
      const dateStr = c.data ? new Date(c.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';
      if (!byDate[dateStr]) byDate[dateStr] = { sum: 0, count: 0 };
      byDate[dateStr].sum += c.erro;
      byDate[dateStr].count += 1;
    });
    const lineData = Object.entries(byDate)
      .map(([date, { sum, count }]) => ({ date, erro: Math.round(sum / count) }))
      .reverse();

    const byTipo: Record<string, { previstoSum: number; realSum: number; count: number }> = {};
    comparacoesRaw.forEach((c) => {
      const tipo = c.tipo ?? 'outros';
      if (!byTipo[tipo]) byTipo[tipo] = { previstoSum: 0, realSum: 0, count: 0 };
      byTipo[tipo].previstoSum += c.previsto;
      byTipo[tipo].realSum += c.real;
      byTipo[tipo].count += 1;
    });
    const barData = Object.entries(byTipo).map(([tipo, { previstoSum, realSum, count }]) => ({
      tipo: tipo.replace(/_/g, ' '),
      previsto: Math.round(previstoSum / count),
      real: Math.round(realSum / count),
    }));

    const byModelo: Record<string, number> = {};
    previsoes.forEach((p) => {
      const v = p.modelo_versao ?? 'desconhecido';
      byModelo[v] = (byModelo[v] ?? 0) + 1;
    });
    const modeloList = Object.entries(byModelo)
      .map(([versao, count]) => ({ versao, count }))
      .sort((a, b) => b.count - a.count);

    return {
      comparacoes: comparacoesRaw.slice(0, 20),
      erroMedio: erroMedioVal,
      pctErroMenor15: pctMenor15,
      tendencia: tendenciaVal,
      lineChartData: lineData,
      barChartData: barData,
      modeloVersoes: modeloList,
    };
  }, [previsoes, atendimentos]);

  const tendenciaConfig = {
    melhorando: { icon: <TrendingDown className="h-5 w-5" />, color: 'green' as const, label: 'Melhorando' },
    piorando: { icon: <TrendingUp className="h-5 w-5" />, color: 'red' as const, label: 'Piorando' },
    estavel: { icon: <Minus className="h-5 w-5" />, color: 'amber' as const, label: 'Estável' },
  };
  const tc = tendenciaConfig[tendencia];

  const hasData = comparacoes.length > 0;

  return (
    <div>
      <PageHeader title="Aprendizado da IA" description="Comparação previsto vs. real — a IA está melhorando?" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          icon={<Target className="h-5 w-5" />}
          label="Erro médio das previsões"
          value={`${erroMedio.toFixed(1)} min`}
          color={erroMedio < 15 ? 'green' : erroMedio < 30 ? 'amber' : 'red'}
        />
        <KpiCard
          icon={<CheckCircleSmall />}
          label="Previsões com erro < 15min"
          value={`${pctErroMenor15.toFixed(0)}%`}
          color={pctErroMenor15 > 70 ? 'green' : 'amber'}
        />
        <KpiCard
          icon={tc.icon}
          label="Tendência"
          value={tc.label}
          color={tc.color}
        />
      </div>

      {hasData ? (
        <>
          {lineChartData.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Evolução do Erro Médio</h3>
              <p className="text-xs text-slate-400 mb-4">Se o erro está caindo ao longo do tempo, a IA está aprendendo</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} unit="min" />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    formatter={(v) => [`${v} min`, 'Erro médio']}
                  />
                  <Line
                    type="monotone"
                    dataKey="erro"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ fill: '#8b5cf6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {barChartData.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Previsto vs. Real por Tipo</h3>
              <p className="text-xs text-slate-400 mb-4">Comparação de tempo estimado e tempo real por tipo de ocorrência</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tipo" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} unit="min" />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    formatter={(v) => [`${v} min`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="previsto" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Previsto" />
                  <Bar dataKey="real" fill="#14b8a6" radius={[8, 8, 0, 0]} name="Real" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
            <h3 className="text-sm font-semibold text-slate-700 px-5 py-4 border-b border-slate-100">
              Últimas 20 Comparações: Previsto × Real
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Ocorrência</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Previsto (min)</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Real (min)</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Erro (min)</th>
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Modelo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {comparacoes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">
                        {c.ocorrencia_id ? `OC-${c.ocorrencia_id.substring(0, 8)}` : '—'}
                        {c.tipo && <span className="ml-2 text-xs text-slate-400">{c.tipo}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-violet-600 font-medium">{c.previsto}</td>
                      <td className="px-4 py-3 text-right text-xs text-teal-600 font-medium">{c.real}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            c.erro < 15
                              ? 'bg-green-50 text-green-600'
                              : c.erro < 30
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {c.erro}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{c.modelo_versao ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="h-4 w-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-slate-700">Evolução do Modelo</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {modeloVersoes.map((m) => (
                <div
                  key={m.versao}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <Brain className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{m.versao}</p>
                    <p className="text-xs text-slate-400">{m.count} previsões</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <EmptyState
            icon={<Brain className="h-7 w-7" />}
            title="Sem dados de aprendizado"
            message="Para mostrar a evolução da IA, são necessários registros de previsões cruzados com atendimentos finalizados (com data de restabelecimento)."
          />
        </div>
      )}
    </div>
  );
}

function CheckCircleSmall() {
  return <Target className="h-5 w-5" />;
}