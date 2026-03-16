'use client';

import { useState, useEffect } from 'react';
import HeroMetrics from '../components/HeroMetrics';
import {
  fetchEvents,
  fetchZones,
  fetchOrders,
  fetchCheckins,
  fetchEscalations,
  DulosEvent,
  TicketZone,
  Order,
  Checkin,
  Escalation,
} from '../lib/supabase';

interface Alerta {
  id: number | string;
  tipo: 'critico' | 'warning' | 'info';
  mensaje: string;
}

interface Actividad {
  id: string;
  tipo: string;
  mensaje: string;
  tiempo: string;
}

const emptyMetrics = {
  revenue: { label: 'Ingresos del Mes', value: '$0 MXN', trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0,0] },
  tickets: { label: 'Boletos Vendidos', value: '0', trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0,0] },
  occupancy: { label: 'Ocupación Promedio', value: '0%', trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0,0] },
  upcoming: { label: 'Funciones Próximas', value: '0', trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0,0] },
};

function getActividadEmoji(tipo: string): string {
  switch (tipo) {
    case 'venta': return '🎟️';
    case 'reembolso': return '💸';
    case 'checkin': return '✅';
    default: return '📌';
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

function SkeletonMetrics() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
      {[1,2,3,4].map((i) => (
        <div key={i} className="metric-card p-3">
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}

export default function SummaryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [funcionesProximas, setFuncionesProximas] = useState<{ id: number; nombre: string; hora: string; sala: string; ocupacion: number; available: number; image_url: string }[]>([]);
  const [actividadReciente, setActividadReciente] = useState<Actividad[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [events, zones, orders, checkins, escalations] = await Promise.all([
          fetchEvents().catch(() => [] as DulosEvent[]),
          fetchZones().catch(() => [] as TicketZone[]),
          fetchOrders().catch(() => [] as Order[]),
          fetchCheckins().catch(() => [] as Checkin[]),
          fetchEscalations().catch(() => [] as Escalation[]),
        ]);

        const totalRevenue = zones.reduce((sum, z) => sum + (z.sold * z.price), 0);
        const totalTickets = zones.reduce((sum, z) => sum + z.sold, 0);
        const totalAvailable = zones.reduce((sum, z) => sum + z.available + z.sold, 0);
        const occupancy = totalAvailable > 0 ? Math.round((totalTickets / totalAvailable) * 100) : 0;

        setMetrics({
          revenue: { label: 'Ingresos del Mes', value: `$${totalRevenue.toLocaleString()} MXN`, trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0, totalRevenue > 0 ? 100 : 0] },
          tickets: { label: 'Boletos Vendidos', value: totalTickets.toLocaleString(), trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0, totalTickets > 0 ? 100 : 0] },
          occupancy: { label: 'Ocupación Promedio', value: `${occupancy}%`, trend: { value: 0, isPositive: occupancy >= 70 }, sparkline: [0,0,0,0, occupancy] },
          upcoming: { label: 'Funciones Próximas', value: String(events.length), trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0, events.length] },
        });

        // Alerts from zones
        const newAlertas: Alerta[] = [];
        const eventMap = new Map(events.map((e) => [e.id, e]));
        zones.forEach((zone, idx) => {
          if (zone.available < 50) {
            const eventName = eventMap.get(zone.event_id)?.name || zone.event_id;
            newAlertas.push({ id: `z-${idx}`, tipo: 'critico', mensaje: `${eventName} - ${zone.zone_name}: ${zone.available} lugares` });
          }
        });
        escalations.forEach((esc, idx) => {
          newAlertas.push({ id: `e-${idx}`, tipo: 'critico', mensaje: `${esc.reason} - ${esc.event_mentioned}` });
        });
        setAlertas(newAlertas.slice(0, 4));

        // Funciones from events + zones
        setFuncionesProximas(events.slice(0, 6).map((event, idx) => {
          const ez = zones.filter((z) => z.event_id === event.id);
          const sold = ez.reduce((s, z) => s + z.sold, 0);
          const total = ez.reduce((s, z) => s + z.available + z.sold, 0);
          return {
            id: idx + 1,
            nombre: event.name,
            hora: event.dates || 'TBD',
            sala: event.venue,
            ocupacion: total > 0 ? Math.round((sold / total) * 100) : 0,
            available: ez.reduce((s, z) => s + z.available, 0),
            image_url: event.image_url || '',
          };
        }));

        // Activity — filter out DUPLICADO and null names, deduplicate
        const actividades: Actividad[] = [];
        const seen = new Set<string>();

        checkins.filter(c => c.customer_name && c.customer_name !== 'DUPLICADO').slice(0, 4).forEach((c) => {
          const key = `${c.customer_name}-${c.event_name}`;
          if (!seen.has(key)) {
            seen.add(key);
            actividades.push({ id: `ci-${c.id}`, tipo: 'checkin', mensaje: `${c.customer_name} → ${c.event_name}`, tiempo: formatTimeAgo(c.scanned_at) });
          }
        });

        orders.filter(o => o.customer_name && o.customer_name !== 'null').slice(0, 4).forEach((o) => {
          const eventName = eventMap.get(o.event_id)?.name || o.event_id;
          const key = `${o.customer_name}-${eventName}`;
          if (!seen.has(key)) {
            seen.add(key);
            actividades.push({ id: `or-${o.order_number}`, tipo: 'venta', mensaje: `${o.customer_name} - ${eventName}`, tiempo: formatTimeAgo(o.purchased_at) });
          }
        });

        setActividadReciente(actividades.slice(0, 8));
        setLoading(false);
      } catch (err) {
        console.error('Error loading dashboard:', err);
        setError('Error conectando con Supabase.');
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="space-y-3"><SkeletonMetrics /><div className="h-40 bg-gray-100 rounded-lg animate-pulse" /></div>;

  if (error) return (
    <div className="flex flex-col items-center justify-center py-12 text-red-500">
      <p className="text-sm font-medium">{error}</p>
      <button onClick={() => window.location.reload()} className="mt-2 text-xs text-[#E63946] hover:underline">Reintentar</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <HeroMetrics revenue={metrics.revenue} tickets={metrics.tickets} occupancy={metrics.occupancy} upcoming={metrics.upcoming} />

      {/* Funciones Próximas */}
      <div className="section-card">
        <div className="section-card-header !py-2 !px-3">
          <span className="section-card-title text-sm">🎭 Funciones Próximas</span>
          {alertas.length > 0 && <span className="badge badge-error ml-auto text-xs">{alertas.length} alertas</span>}
        </div>
        {funcionesProximas.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 p-3">
            {funcionesProximas.map((f) => {
              const hasAlert = alertas.some(a => a.mensaje.toLowerCase().includes(f.nombre.toLowerCase()));
              return (
                <div key={f.id} className={`flex items-center gap-2 p-2 rounded-lg border ${hasAlert ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
                  {f.image_url ? (
                    <img src={f.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm">🎭</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-xs truncate">{f.nombre}</p>
                    <p className="text-[11px] text-gray-500 truncate">{f.hora} · {f.sala}</p>
                    <p className={`text-[11px] font-medium ${f.available < 50 ? 'text-red-500' : 'text-emerald-600'}`}>{f.available} disponibles</p>
                  </div>
                  <span className={`text-xs font-bold ${f.ocupacion >= 80 ? 'text-red-500' : f.ocupacion >= 50 ? 'text-amber-500' : 'text-gray-400'}`}>{f.ocupacion}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actividad Reciente */}
      {actividadReciente.length > 0 && (
        <div className="section-card">
          <div className="section-card-header !py-2 !px-3">
            <span className="section-card-title text-sm">⚡ Actividad Reciente</span>
          </div>
          <div className="divide-y divide-gray-50">
            {actividadReciente.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="text-xs">{getActividadEmoji(a.tipo)}</span>
                <p className="flex-1 text-xs text-gray-700 truncate">{a.mensaje}</p>
                <span className="text-[11px] text-gray-400 tabular-nums">{a.tiempo}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
