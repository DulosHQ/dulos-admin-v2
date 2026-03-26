'use client';

export interface MetricData {
  label: string;
  value: string;
  change?: number; // % change vs previous period, positive = good
  iconKey: string;
}

interface HeroMetricsProps {
  metrics: MetricData[];
}

/* Premium filled icons — Dulos brand red with gradient depth */
const METRIC_ICONS: Record<string, React.ReactNode> = {
  revenue: (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="rev" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EF4444"/><stop offset="1" stopColor="#C1121F"/>
        </linearGradient>
      </defs>
      <path d="M2.5 7.5A2.5 2.5 0 015 5h14a2.5 2.5 0 012.5 2.5v9A2.5 2.5 0 0119 19H5a2.5 2.5 0 01-2.5-2.5v-9z" fill="url(#rev)" opacity=".12"/>
      <path d="M2.5 7.5A2.5 2.5 0 015 5h14a2.5 2.5 0 012.5 2.5v9A2.5 2.5 0 0119 19H5a2.5 2.5 0 01-2.5-2.5v-9z" stroke="url(#rev)" strokeWidth="1.4"/>
      <circle cx="12" cy="12" r="3.5" stroke="url(#rev)" strokeWidth="1.3"/>
      <path d="M12 10v.5m0 3v.5m-1.2-3.3c.2-.5.6-.7 1.2-.7.8 0 1.3.4 1.3.9s-.4.8-1.3.8c-.8 0-1.3.4-1.3.9s.5.9 1.3.9c.6 0 1-.2 1.2-.7" stroke="url(#rev)" strokeWidth="1.1" strokeLinecap="round"/>
      <circle cx="5.5" cy="8.5" r=".6" fill="#EF4444"/><circle cx="18.5" cy="15.5" r=".6" fill="#EF4444"/>
    </svg>
  ),
  orders: (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ord" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EF4444"/><stop offset="1" stopColor="#C1121F"/>
        </linearGradient>
      </defs>
      <rect x="4" y="3" width="16" height="18" rx="2" fill="url(#ord)" opacity=".12"/>
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="url(#ord)" strokeWidth="1.4"/>
      <path d="M8 8h8M8 12h6M8 16h4" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  tickets: (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="tix" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EF4444"/><stop offset="1" stopColor="#C1121F"/>
        </linearGradient>
      </defs>
      <path d="M4 7.5A1.5 1.5 0 015.5 6h13A1.5 1.5 0 0120 7.5V10a2 2 0 100 4v2.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5V14a2 2 0 100-4V7.5z" fill="url(#tix)" opacity=".12"/>
      <path d="M4 7.5A1.5 1.5 0 015.5 6h13A1.5 1.5 0 0120 7.5V10a2 2 0 100 4v2.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5V14a2 2 0 100-4V7.5z" stroke="url(#tix)" strokeWidth="1.4"/>
      <line x1="9" y1="6" x2="9" y2="18" stroke="url(#tix)" strokeWidth="1.2" strokeDasharray="2 2"/>
      <path d="M12.5 10.5l1.5 1.5-1.5 1.5" stroke="#EF4444" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6.5" cy="9" r=".5" fill="#EF4444"/><circle cx="6.5" cy="12" r=".5" fill="#EF4444"/><circle cx="6.5" cy="15" r=".5" fill="#EF4444"/>
    </svg>
  ),
  avgPrice: (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="avg" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EF4444" stopOpacity=".6"/><stop offset="1" stopColor="#EF4444"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" fill="url(#avg)" opacity=".12"/>
      <circle cx="12" cy="12" r="9" stroke="url(#avg)" strokeWidth="1.4"/>
      <path d="M12 7v1m0 8v1m-2.5-7.5c.3-.6.9-1 1.8-1 1.2 0 2 .6 2 1.4 0 .8-.6 1.2-2 1.2-1.3 0-2 .5-2 1.3 0 .8.8 1.4 2 1.4.9 0 1.5-.4 1.8-1" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
};

const DEFAULT_ICON = (
  <svg className="w-[22px] h-[22px]" fill="none" stroke="#EF4444" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

function MetricCard({ metric }: { metric: MetricData }) {
  const icon = METRIC_ICONS[metric.iconKey] || DEFAULT_ICON;
  const hasChange = metric.change !== undefined && metric.change !== 0;
  const isPositive = (metric.change ?? 0) > 0;

  return (
    <div className="bg-[#111] rounded-lg border border-gray-800 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-6 h-6 flex items-center justify-center">{icon}</div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{metric.label}</p>
      </div>
      <p className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">{metric.value}</p>
      {hasChange && (
        <div className="mt-1.5">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold ${isPositive ? 'bg-green-50 text-green-700' : 'bg-red-500/10 text-red-400'}`}>
            {isPositive ? '+' : ''}{metric.change?.toFixed(1)}% vs período anterior
          </span>
        </div>
      )}
    </div>
  );
}

export default function HeroMetrics({ metrics }: HeroMetricsProps) {
  const cols = metrics.length <= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-5';
  return (
    <div className={`grid grid-cols-2 md:grid-cols-2 ${cols} gap-3 lg:gap-4`}>
      {metrics.map((m) => (
        <MetricCard key={m.iconKey} metric={m} />
      ))}
    </div>
  );
}
