import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { useLatestActivity } from '@/hooks/useLatestActivity';
import type { IaCorrelacao, IaPrioridade, IaRecomendacaoEquipe, IaPrevisao, Chamado, Ocorrencia } from '@/types';

export function Layout() {
  const { data: chamados } = useRealtimeTable<Chamado>({ table: 'chamados', orderBy: 'data_hora', limit: 1 });
  const { data: correlacoes } = useRealtimeTable<IaCorrelacao>({ table: 'ia_correlacoes', limit: 1 });
  const { data: prioridades } = useRealtimeTable<IaPrioridade>({ table: 'ia_prioridades', limit: 1 });
  const { data: despachos } = useRealtimeTable<IaRecomendacaoEquipe>({ table: 'ia_recomendacoes_equipes', limit: 1 });
  const { data: previsoes } = useRealtimeTable<IaPrevisao>({ table: 'ia_previsoes', limit: 1 });
  const { data: ocorrencias } = useRealtimeTable<Ocorrencia>({ table: 'ocorrencias', orderBy: 'ia_atualizado_em', limit: 1 });

  const timestamps = [
    chamados[0]?.data_hora,
    correlacoes[0]?.criado_em,
    prioridades[0]?.criado_em,
    despachos[0]?.criado_em,
    previsoes[0]?.criado_em,
    ocorrencias[0]?.ia_atualizado_em,
  ];

  const { isActive, label } = useLatestActivity(timestamps);

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-60 flex min-h-screen flex-col">
        <Header isActive={isActive} activityLabel={label} />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
