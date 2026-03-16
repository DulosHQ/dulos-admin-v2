'use client';

import { useState, useEffect } from 'react';
import HeroMetrics from '../components/HeroMetrics';
import {
  fetchEvents,
  fetchZones,
  fetchOrders,
  fetchCheckins,
  fetchEscalations,
  fetchTickets,
  DulosEvent,
  TicketZone,
  Order,
  Checkin,
  Escalation,
  Ticket,
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
  const [ventasRecientes, setVentasRecientes] = useState<{ id: string; cliente: string; evento: string; zona: string; total: number; fecha: string }[]>([]);
  const [boletosRecientes, setBoletosRecientes] = useState<{ id: string; ticket: string; cliente: string; evento: string; zona: string; status: string; fecha: string }[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [events, zones, orders, checkins, escalations, tickets] = await Promise.all([
          fetchEvents().catch(() => [] as DulosEvent[]),
          fetchZones().catch(() => [] as TicketZone[]),
          fetchOrders().catch(() => [] as Order[]),
          fetchCheckins().catch(() => [] as Checkin[]),
          fetchEscalations().catch(() => [] as Escalation[]),
          fetchTickets().catch(() => [] as Ticket[]),
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

        // Boletos recientes from tickets
        setBoletosRecientes(tickets.filter(t => t.customer_name).slice(0, 6).map(t => ({
          id: t.id,
          ticket: t.ticket_number,
          cliente: t.customer_name || 'Anónimo',
          evento: eventMap.get(t.event_id)?.name || t.event_id,
          zona: t.zone_name,
          status: t.status,
          fecha: formatTimeAgo(t.created_at),
        })));

        // Ventas recientes from orders
        setVentasRecientes(orders.filter(o => o.customer_name).slice(0, 6).map(o => ({
          id: o.order_number,
          cliente: o.customer_name || 'Anónimo',
          evento: eventMap.get(o.event_id)?.name || o.event_id,
          zona: o.zone_name,
          total: o.total_price,
          fecha: formatTimeAgo(o.purchased_at),
        })));

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
          <span className="font-bold text-gray-900 text-sm">🎭 Funciones Próximas</span>
          {alertas.length > 0 && <span className="badge badge-error ml-auto text-xs">{alertas.length} alertas</span>}
        </div>
        {funcionesProximas.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 p-3">
            {funcionesProximas.map((f) => {
              const hasAlert = alertas.some(a => a.mensaje.toLowerCase().includes(f.nombre.toLowerCase()));
              return (
                <div key={f.id} className={`flex gap-3 p-3 rounded-xl border transition-all hover:shadow-sm ${hasAlert ? 'border-red-200 bg-red-50/30' : 'border-gray-100 bg-white'}`}>
                  {f.image_url ? (
                    <img src={f.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shadow-sm flex-shrink-0 self-center" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0 self-center">🎭</div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-extrabold text-gray-900 text-[13px] truncate leading-tight">{f.nombre}</p>
                      <span className={`text-[13px] font-black flex-shrink-0 ${f.ocupacion >= 80 ? 'text-red-500' : f.ocupacion >= 50 ? 'text-amber-500' : 'text-gray-300'}`}>{f.ocupacion}%</span>
                    </div>
                    <p className="text-[12px] text-gray-500 mt-1 truncate font-medium">{f.hora} · {f.sala}</p>
                    <p className={`text-[12px] font-bold mt-0.5 ${f.available < 50 ? 'text-red-500' : 'text-emerald-600'}`}>{f.available} disponibles</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actividad + Ventas side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Actividad Reciente */}
        {actividadReciente.length > 0 && (
          <div className="section-card">
            <div className="section-card-header !py-2 !px-3">
              <span className="font-bold text-gray-900 text-sm">⚡ Actividad Reciente</span>
            </div>
            <div className="divide-y divide-gray-50">
              {actividadReciente.map((a) => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="text-sm">{getActividadEmoji(a.tipo)}</span>
                  <p className="flex-1 text-[13px] text-gray-700 truncate font-medium">{a.mensaje}</p>
                  <span className="text-[12px] text-gray-400 tabular-nums font-semibold">{a.tiempo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Boletos Vendidos */}
        {boletosRecientes.length > 0 && (
          <div className="section-card">
            <div className="section-card-header !py-2 !px-3">
              <span className="font-bold text-gray-900 text-sm">🎫 Boletos Vendidos</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="px-3 py-1.5 font-medium">Ticket</th>
                  <th className="px-3 py-1.5 font-medium">Cliente</th>
                  <th className="px-3 py-1.5 font-medium">Evento</th>
                  <th className="px-3 py-1.5 font-medium">Zona</th>
                  <th className="px-3 py-1.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {boletosRecientes.map((b) => (
                  <tr key={b.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-1.5 font-mono text-xs text-[#E63946]">{b.ticket}</td>
                    <td className="px-3 py-1.5 text-gray-900">{b.cliente}</td>
                    <td className="px-3 py-1.5 text-gray-600 truncate max-w-[120px]">{b.evento}</td>
                    <td className="px-3 py-1.5 text-gray-500">{b.zona}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${b.status === 'valid' ? 'bg-green-50 text-green-700' : b.status === 'used' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {b.status === 'valid' ? 'Válido' : b.status === 'used' ? 'Usado' : b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
