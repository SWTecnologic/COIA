import { Link } from 'react-router-dom';
import {
  Inbox,
  GitMerge,
  Flag,
  Truck,
  Clock,
  Brain,
  ArrowRight,
} from 'lucide-react';

const arrow = (
  <div className="flex items-center text-slate-300 flex-shrink-0">
    <ArrowRight className="h-4 w-4" />
  </div>
);

interface PipelineProps {
  counts: {
    chamados: number;
    correlacoes: number;
    prioridades: number;
    despachos: number;
    previsoes: number;
    ocorrencias: number;
  };
  size?: 'sm' | 'lg';
}

export function Pipeline({ counts, size = 'sm' }: PipelineProps) {
  const cardWidth = size === 'lg' ? 'w-44' : 'w-36';
  const iconSize = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const pad = size === 'lg' ? 'p-5' : 'p-4';

  const steps: {
    icon: React.ReactNode;
    name: string;
    count: number;
    color: {
      borderColor: string;
      bgColor: string;
      iconBgColor: string;
      textColor: string;
    };
  }[] = [
    {
      icon: <Inbox className={iconSize} />,
      name: 'Chamados',
      count: counts.chamados,
      color: {
        borderColor: 'border-violet-200',
        bgColor: 'bg-violet-50/50',
        iconBgColor: 'bg-violet-500 text-white',
        textColor: 'text-violet-700',
      },
    },
    {
      icon: <GitMerge className={iconSize} />,
      name: 'Correlação',
      count: counts.correlacoes,
      color: {
        borderColor: 'border-blue-200',
        bgColor: 'bg-blue-50/50',
        iconBgColor: 'bg-blue-500 text-white',
        textColor: 'text-blue-700',
      },
    },
    {
      icon: <Flag className={iconSize} />,
      name: 'Prioridade',
      count: counts.prioridades,
      color: {
        borderColor: 'border-amber-200',
        bgColor: 'bg-amber-50/50',
        iconBgColor: 'bg-amber-500 text-white',
        textColor: 'text-amber-700',
      },
    },
    {
      icon: <Truck className={iconSize} />,
      name: 'Despacho',
      count: counts.despachos,
      color: {
        borderColor: 'border-indigo-200',
        bgColor: 'bg-indigo-50/50',
        iconBgColor: 'bg-indigo-500 text-white',
        textColor: 'text-indigo-700',
      },
    },
    {
      icon: <Clock className={iconSize} />,
      name: 'Previsão',
      count: counts.previsoes,
      color: {
        borderColor: 'border-teal-200',
        bgColor: 'bg-teal-50/50',
        iconBgColor: 'bg-teal-500 text-white',
        textColor: 'text-teal-700',
      },
    },
    {
      icon: <Brain className={iconSize} />,
      name: 'Ocorrências IA',
      count: counts.ocorrencias,
      color: {
        borderColor: 'border-green-200',
        bgColor: 'bg-green-50/50',
        iconBgColor: 'bg-green-500 text-white',
        textColor: 'text-green-700',
      },
    },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={step.name} className="flex items-center gap-2 flex-shrink-0">
          <Link
            to="/pipeline"
            className={`group relative flex flex-col items-center gap-2 rounded-2xl border ${pad} transition-all ${cardWidth} ${
              step.count > 0
                ? `${step.color.borderColor} ${step.color.bgColor} shadow-sm hover:shadow-md`
                : 'border-slate-200 bg-white shadow-sm'
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                step.count > 0 ? step.color.iconBgColor : 'bg-slate-100 text-slate-300'
              }`}
            >
              {step.icon}
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-slate-500 leading-tight">{step.name}</p>
              <p
                className={`text-2xl font-bold leading-tight ${
                  step.count > 0 ? step.color.textColor : 'text-slate-300'
                }`}
              >
                {step.count}
              </p>
            </div>
          </Link>
          {i < steps.length - 1 && arrow}
        </div>
      ))}
    </div>
  );
}
