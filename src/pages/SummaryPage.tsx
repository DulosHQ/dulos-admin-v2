'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  fetchWarRoomKPIs,
  fetchWarRoomEvents,
  fetchWarRoomActivity,
  WarRoomKPIs,
  WarRoomEvent,
  WarRoomActivity,
} from '../lib/supabase';

const fmtCurrency = (n: number) => new Intl.NumberFormat('es-MX', { 
  style: 'currency', 
  currency: 'MXN', 
  minimumFractionDigits: 0 
}).format(n);

const fmtDate = (dateStr: string | null) => {
  if (!dateStr) return 'TBD';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'TBD';
  }
};

const formatTimeAgo = (timeAgo: string) => timeAgo;

function StatusBadge({ status }: { status: 'on_track' | 'slow' | 'critical' }) {
  if (status === 'on_track') {
    return <span className="text-xs font-bold text-green-400">🟢 On track</span>;
  }
  if (status === 'slow') {
    return <span className="text-xs font-bold text-yellow-400">🟡 Lento</span>;
  }
  return <span className="text-xs font-bold text-red-400">🔴 Crítico</span>;
}

function Sparkline({ data, width = 60, height = 20 }: { data: number[]; width?: number; height?: number }) {
  if (data.length === 0) return <div className={`w-[${width}px] h-[${height}px]`} />;
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="text-gray-400">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

function ProgressBar({ percentage, className = '' }: { percentage: number; className?: string }) {
  const pct = Math.min(Math.max(percentage, 0), 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 30 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className={`w-full bg-gray-700 rounded-full h-2 ${className}`}>
      <div
        className={`h-2 rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SkeletonKPIs() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-[#111] rounded-xl p-4">
          <div className="h-3 bg-gray-700 rounded w-2/3 mb-2"></div>
          <div className="h-6 bg-gray-700 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}

function SkeletonEvents() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-[#111] rounded-xl p-4 flex gap-4">
          <div className="w-16 h-16 rounded-lg bg-gray-700 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-700 rounded w-1/3" />
            <div className="h-3 bg-gray-700 rounded w-1/4" />
            <div className="h-2 bg-gray-700 rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SummaryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKPIs] = useState<WarRoomKPIs | null>(null);
  const [events, setEvents] = useState<WarRoomEvent[]>([]);
  const [activity, setActivity] = useState<WarRoomActivity[]>([]);

  useEffect(() => {
    async function loadWarRoomData() {
      try {
        setLoading(true);
        setError(null);

        const [kpiData, eventsData, activityData] = await Promise.all([
          fetchWarRoomKPIs(),
          fetchWarRoomEvents(),
          fetchWarRoomActivity(),
        ]);

        setKPIs(kpiData);
        setEvents(eventsData);
        setActivity(activityData);
      } catch (err) {
        console.error('Error loading war room data:', err);
        setError('Error cargando datos del dashboard');
        toast.error('Error cargando datos del dashboard');
      } finally {
        setLoading(false);
      }
    }

    loadWarRoomData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonKPIs />
        <div className="bg-[#111] rounded-xl p-4">
          <div className="h-4 bg-gray-700 rounded w-32 mb-4" />
          <SkeletonEvents />
        </div>
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-400">
        <p className="text-sm font-medium">{error || 'Error desconocido'}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 text-xs text-red-400 hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* War Room KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Eventos activos</p>
          <p className="text-2xl font-black text-white">{kpis.activeEvents}</p>
        </div>

        <div className="bg-[#111] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Ocupación promedio</p>
          <p className="text-2xl font-black text-white">{kpis.avgOccupancy}%</p>
          <p className="text-xs text-gray-500 mt-1">north star</p>
        </div>

        <div className="bg-[#111] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Revenue total</p>
          <p className="text-2xl font-black text-green-400">{fmtCurrency(kpis.totalRevenue)}</p>
        </div>

        <div className="bg-[#111] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Ad Spend total</p>
          <p className="text-2xl font-black text-blue-400">
            {kpis.totalAdSpend > 0 ? fmtCurrency(kpis.totalAdSpend) : '—'}
          </p>
        </div>
      </div>

      {/* War Room Events */}
      <div className="bg-[#111] rounded-xl">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Eventos · War Room de Sold Out</h2>
          <p className="text-xs text-gray-400">Ordenados por próxima función (más urgente primero)</p>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">No hay eventos activos con funciones próximas</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {events.map((event) => (
              <div key={event.id} className="p-4 hover:bg-gray-900/50 transition-colors">
                <div className="flex gap-4">
                  {/* Event Image */}
                  {event.image_url ? (
                    <img 
                      src={event.image_url} 
                      alt={event.name} 
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0 text-gray-600 text-2xl">
                      🎭
                    </div>
                  )}

                  {/* Event Details */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white text-lg leading-tight truncate">
                          {event.name}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {event.venue_name}
                          {event.venue_city && ` · ${event.venue_city}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          Próxima función: {fmtDate(event.next_date)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <StatusBadge status={event.status} />
                      </div>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-3">
                      {/* Occupancy */}
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Ocupación</p>
                        <ProgressBar percentage={event.occupancy_pct} />
                        <p className="text-xs text-white font-bold mt-1">{event.occupancy_pct}%</p>
                      </div>

                      {/* Sparkline */}
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Tendencia (14d)</p>
                        <div className="flex items-center h-5">
                          <Sparkline data={event.sales_trend} />
                        </div>
                      </div>

                      {/* Ad Spend */}
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Ad Spend</p>
                        <p className="text-sm font-bold text-blue-400">
                          {event.ad_spend > 0 ? fmtCurrency(event.ad_spend) : '—'}
                        </p>
                      </div>

                      {/* Revenue */}
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Revenue</p>
                        <p className="text-sm font-bold text-green-400">{fmtCurrency(event.revenue)}</p>
                      </div>

                      {/* ROAS */}
                      <div>
                        <p className="text-xs text-gray-400 mb-1">ROAS</p>
                        <p className="text-sm font-bold text-yellow-400">
                          {event.roas !== null ? `${event.roas.toFixed(1)}x` : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Capacity Info */}
                    <div className="text-xs text-gray-500">
                      {event.total_sold} vendidos de {event.total_capacity} · {event.total_capacity - event.total_sold} disponibles
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div className="bg-[#111] rounded-xl">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Actividad Reciente</h2>
          <p className="text-xs text-gray-400">Últimas ventas y check-ins</p>
        </div>

        {activity.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">No hay actividad reciente</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {activity.slice(0, 10).map((item) => (
              <div key={item.id} className="p-3 hover:bg-gray-900/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm flex-shrink-0">
                    {item.type === 'sale' ? '💰' : '✅'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      <span className="font-medium">{item.customer_name}</span>
                      <span className="text-gray-400"> → </span>
                      <span className="text-gray-300">{item.event_name}</span>
                    </p>
                  </div>
                  {item.amount && (
                    <span className="text-xs font-bold text-green-400 tabular-nums flex-shrink-0">
                      {fmtCurrency(item.amount)}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">
                    {formatTimeAgo(item.time_ago)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}