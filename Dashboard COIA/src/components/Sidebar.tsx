import { NavLink } from 'react-router-dom';
import { LayoutDashboard, GitBranch, AlertTriangle, Brain, ListChecks, Zap } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { to: '/erros', label: 'Erros e Falhas', icon: AlertTriangle },
  { to: '/aprendizado', label: 'Aprendizado', icon: Brain },
  { to: '/decisoes', label: 'Feed de Decisões', icon: ListChecks },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/30">
          <Zap className="h-5 w-5" fill="currentColor" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-800 leading-tight">COIA <span className="text-violet-600">V.1</span></h1>
          <p className="text-xs text-slate-400 leading-tight">Motor de IA</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`
            }
          >
            <Icon className="h-4.5 w-4.5 flex-shrink-0" style={{ width: 18, height: 18 }} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 px-5 py-4">
        <p className="text-xs text-slate-400">Monitoramento em tempo real</p>
      </div>
    </aside>
  );
}
