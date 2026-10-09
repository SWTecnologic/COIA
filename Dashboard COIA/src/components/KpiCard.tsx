interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  color: 'violet' | 'blue' | 'green' | 'amber' | 'red' | 'indigo' | 'teal';
}

const colorMap = {
  violet: { iconBg: 'bg-violet-100 text-violet-600', accent: 'text-violet-700' },
  blue: { iconBg: 'bg-blue-100 text-blue-600', accent: 'text-blue-700' },
  green: { iconBg: 'bg-green-100 text-green-600', accent: 'text-green-700' },
  amber: { iconBg: 'bg-amber-100 text-amber-600', accent: 'text-amber-700' },
  red: { iconBg: 'bg-red-100 text-red-600', accent: 'text-red-700' },
  indigo: { iconBg: 'bg-indigo-100 text-indigo-600', accent: 'text-indigo-700' },
  teal: { iconBg: 'bg-teal-100 text-teal-600', accent: 'text-teal-700' },
};

export function KpiCard({ icon, label, value, subtitle, color }: KpiCardProps) {
  const c = colorMap[color];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.iconBg}`}>
          {icon}
        </div>
        {subtitle && (
          <span className="text-xs font-medium text-slate-400">{subtitle}</span>
        )}
      </div>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${c.accent}`}>{value}</p>
    </div>
  );
}
