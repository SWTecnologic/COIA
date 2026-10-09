import { Zap } from 'lucide-react';

interface HeaderProps {
  isActive: boolean;
  activityLabel: string;
}

export function Header({ isActive, activityLabel }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3.5 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-semibold text-slate-700">Monitor do Motor</span>
        <span className="hidden sm:inline text-xs text-slate-400">· Dashboard em tempo real</span>
      </div>

      <div className="flex items-center gap-2.5">
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
            isActive
              ? 'bg-green-50 text-green-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className="relative flex h-2.5 w-2.5">
            {isActive && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                isActive ? 'bg-green-500' : 'bg-slate-400'
              }`}
            />
          </span>
          {isActive ? 'Motor ativo' : 'Aguardando'}
          <span className="text-slate-400 font-normal">{activityLabel}</span>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
          <Zap className="h-4 w-4" fill="currentColor" />
        </div>
      </div>
    </header>
  );
}
