'use client';

interface TrendData {
  value: number;
  isPositive: boolean;
}

interface MetricData {
  label: string;
  value: string;
  trend: TrendData;
  sparkline: number[];
}

interface HeroMetricsProps {
  revenue: MetricData;
  tickets: MetricData;
  occupancy: MetricData;
  upcoming: MetricData;
}

/* Premium filled icons — Dulos brand red with gradient depth */
const METRIC_ICONS: Record<string, React.ReactNode> = {
  'Ingresos del Mes': (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="rev" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E63946"/><stop offset="1" stopColor="#C1121F"/>
        </linearGradient>
      </defs>
      <path d="M2.5 7.5A2.5 2.5 0 015 5h14a2.5 2.5 0 012.5 2.5v9A2.5 2.5 0 0119 19H5a2.5 2.5 0 01-2.5-2.5v-9z" fill="url(#rev)" opacity=".12"/>
      <path d="M2.5 7.5A2.5 2.5 0 015 5h14a2.5 2.5 0 012.5 2.5v9A2.5 2.5 0 0119 19H5a2.5 2.5 0 01-2.5-2.5v-9z" stroke="url(#rev)" strokeWidth="1.4"/>
      <circle cx="12" cy="12" r="3.5" stroke="url(#rev)" strokeWidth="1.3"/>
      <path d="M12 10v.5m0 3v.5m-1.2-3.3c.2-.5.6-.7 1.2-.7.8 0 1.3.4 1.3.9s-.4.8-1.3.8c-.8 0-1.3.4-1.3.9s.5.9 1.3.9c.6 0 1-.2 1.2-.7" stroke="url(#rev)" strokeWidth="1.1" strokeLinecap="round"/>
      <circle cx="5.5" cy="8.5" r=".6" fill="#E63946"/><circle cx="18.5" cy="15.5" r=".6" fill="#E63946"/>
    </svg>
  ),
  'Boletos Vendidos': (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="tix" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E63946"/><stop offset="1" stopColor="#C1121F"/>
        </linearGradient>
      </defs>
      <path d="M4 7.5A1.5 1.5 0 015.5 6h13A1.5 1.5 0 0120 7.5V10a2 2 0 100 4v2.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5V14a2 2 0 100-4V7.5z" fill="url(#tix)" opacity=".12"/>
      <path d="M4 7.5A1.5 1.5 0 015.5 6h13A1.5 1.5 0 0120 7.5V10a2 2 0 100 4v2.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5V14a2 2 0 100-4V7.5z" stroke="url(#tix)" strokeWidth="1.4"/>
      <line x1="9" y1="6" x2="9" y2="18" stroke="url(#tix)" strokeWidth="1.2" strokeDasharray="2 2"/>
      <path d="M12.5 10.5l1.5 1.5-1.5 1.5" stroke="#E63946" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6.5" cy="9" r=".5" fill="#E63946"/><circle cx="6.5" cy="12" r=".5" fill="#E63946"/><circle cx="6.5" cy="15" r=".5" fill="#E63946"/>
    </svg>
  ),
  'Ocupación Promedio': (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="occ" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E63946" stopOpacity=".6"/><stop offset="1" stopColor="#E63946"/>
        </linearGradient>
      </defs>
      <rect x="3" y="14" width="3.5" height="6" rx=".8" fill="url(#occ)" opacity=".25"/>
      <rect x="8" y="10" width="3.5" height="10" rx=".8" fill="url(#occ)" opacity=".45"/>
      <rect x="13" y="7" width="3.5" height="13" rx=".8" fill="url(#occ)" opacity=".65"/>
      <rect x="18" y="3" width="3.5" height="17" rx=".8" fill="url(#occ)" opacity=".9"/>
      <path d="M3 20.5h18.5" stroke="#E63946" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  'Funciones Próximas': (
    <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="cal" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E63946"/><stop offset="1" stopColor="#C1121F"/>
        </linearGradient>
      </defs>
      <rect x="3" y="5.5" width="18" height="15" rx="2.5" fill="url(#cal)" opacity=".1"/>
      <rect x="3" y="5.5" width="18" height="15" rx="2.5" stroke="url(#cal)" strokeWidth="1.4"/>
      <rect x="3" y="5.5" width="18" height="4.5" rx="2.5" fill="#E63946" opacity=".9"/>
      <path d="M8 3.5v3m8-3v3" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="6.5" y="13" width="2.2" height="2.2" rx=".5" fill="#E63946" opacity=".6"/>
      <rect x="10.9" y="13" width="2.2" height="2.2" rx=".5" fill="#E63946"/>
      <rect x="15.3" y="13" width="2.2" height="2.2" rx=".5" fill="#E63946" opacity=".35"/>
      <rect x="6.5" y="16.5" width="2.2" height="2.2" rx=".5" fill="#E63946" opacity=".2"/>
      <rect x="10.9" y="16.5" width="2.2" height="2.2" rx=".5" fill="#E63946" opacity=".2"/>
      <rect x="15.3" y="16.5" width="2.2" height="2.2" rx=".5" fill="#E63946" opacity=".2"/>
    </svg>
  ),
};

const DEFAULT_ICON = (
  <svg className="w-[22px] h-[22px]" fill="none" stroke="#E63946" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

function MetricCard({ metric }: { metric: MetricData }) {
  const icon = METRIC_ICONS[metric.label] || DEFAULT_ICON;
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-5 h-5 flex items-center justify-center opacity-60">{icon}</div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{metric.label}</p>
      </div>
      <p className="text-3xl font-black text-gray-900 tracking-tight leading-none">{metric.value}</p>
    </div>
  );
}

export default function HeroMetrics({ revenue, tickets, occupancy, upcoming }: HeroMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard metric={revenue} />
      <MetricCard metric={tickets} />
      <MetricCard metric={occupancy} />
      <MetricCard metric={upcoming} />
    </div>
  );
}
