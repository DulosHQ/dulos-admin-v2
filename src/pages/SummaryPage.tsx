'use client';

import { useState, useEffect } from 'react';
import HeroMetrics from '../components/HeroMetrics';
import {
  fetchEvents,
  fetchZones,
  fetchOrders,
  fetchCustomers,
  fetchCheckins,
  fetchEscalations,
  DulosEvent,
  TicketZone,
  Order,
  Customer,
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

interface ClienteDisplay {
  id: string;
  nombre: string;
  email: string;
  ordenes: number;
  gastado: number;
  boletos: number;
}

const emptyMetrics = {
  revenue: {
    label: 'Ingresos del Mes',
    value: '$0 MXN',
    trend: { value: 0, isPositive: true },
    sparkline: [0, 0, 0, 0, 0],
  },
  tickets: {
    label: 'Boletos Vendidos',
    value: '0',
    trend: { value: 0, isPositive: true },
    sparkline: [0, 0, 0, 0, 0],
  },
  occupancy: {
    label: 'Ocupación Promedio',
    value: '0%',
    trend: { value: 0, isPositive: true },
    sparkline: [0, 0, 0, 0, 0],
  },
  upcoming: {
    label: 'Funciones Próximas',
    value: '0',
    trend: { value: 0, isPositive: true },
    sparkline: [0, 0, 0, 0, 0],
  },
};

function getOcupacionColor(ocupacion: number): string {
  if (ocupacion >= 80) return 'bg-red-500';
  if (ocupacion >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getActividadEmoji(tipo: string): string {
  switch (tipo) {
    case 'venta':
      return '🎟️';
    case 'reembolso':
      return '💸';
    case 'reservacion':
      return '📋';
    case 'cancelacion':
      return '❌';
    case 'checkin':
      return '✅';
    default:
      return '📌';
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays}d`;
}

function SkeletonCard() {
  return (
    <div className="section-card animate-pulse">
      <div className="section-card-header">
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
      </div>
      <div className="section-card-body space-y-3">
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        <div className="h-3 bg-gray-200 rounded w-4/6"></div>
      </div>
    </div>
  );
}

function SkeletonMetrics() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="metric-card">
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-3"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-2 bg-gray-200 rounded w-1/4"></div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p className="text-sm">{message}</p>
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
  const [clientes, setClientes] = useState<ClienteDisplay[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [events, zones, orders, customers, checkins, escalations] = await Promise.all([
          fetchEvents().catch(() => [] as DulosEvent[]),
          fetchZones().catch(() => [] as TicketZone[]),
          fetchOrders().catch(() => [] as Order[]),
          fetchCustomers().catch(() => [] as Customer[]),
          fetchCheckins().catch(() => [] as Checkin[]),
          fetchEscalations().catch(() => [] as Escalation[]),
        ]);

        // Calculate metrics from real data
        const totalRevenue = zones.reduce((sum, zone) => sum + (zone.sold * zone.price), 0);
        const totalTickets = zones.reduce((sum, zone) => sum + zone.sold, 0);
        const totalAvailable = zones.reduce((sum, zone) => sum + zone.available + zone.sold, 0);
        const occupancy = totalAvailable > 0 ? Math.round((totalTickets / totalAvailable) * 100) : 0;
        const upcomingCount = events.length;

        setMetrics({
          revenue: {
            label: 'Ingresos del Mes',
            value: `$${totalRevenue.toLocaleString()} MXN`,
            trend: { value: 0, isPositive: true },
            sparkline: [0, 0, 0, 0, totalRevenue > 0 ? 100 : 0],
          },
          tickets: {
            label: 'Boletos Vendidos',
            value: totalTickets.toLocaleString(),
            trend: { value: 0, isPositive: true },
            sparkline: [0, 0, 0, 0, totalTickets > 0 ? 100 : 0],
          },
          occupancy: {
            label: 'Ocupación Promedio',
            value: `${occupancy}%`,
            trend: { value: 0, isPositive: occupancy >= 70 },
            sparkline: [0, 0, 0, 0, occupancy],
          },
          upcoming: {
            label: 'Funciones Próximas',
            value: String(upcomingCount),
            trend: { value: 0, isPositive: true },
            sparkline: [0, 0, 0, 0, upcomingCount],
          },
        });

        // Build alerts from real zone data
        const newAlertas: Alerta[] = [];
        const eventMap = new Map(events.map((e) => [e.id, e]));

        zones.forEach((zone, idx) => {
          if (zone.available < 50) {
            const event = eventMap.get(zone.event_id);
            const eventName = event?.name || zone.event_id;
            newAlertas.push({
              id: `zone-${idx}`,
              tipo: 'critico',
              mensaje: `${eventName} - ${zone.zone_name}: Solo quedan ${zone.available} lugares`,
            });
          } else if (zone.available < 100) {
            const event = eventMap.get(zone.event_id);
            const eventName = event?.name || zone.event_id;
            newAlertas.push({
              id: `zone-warn-${idx}`,
              tipo: 'warning',
              mensaje: `${eventName} - ${zone.zone_name}: ${zone.available} lugares disponibles`,
            });
          }
        });

        escalations.forEach((esc, idx) => {
          newAlertas.push({
            id: `esc-${idx}`,
            tipo: 'critico',
            mensaje: `Escalación: ${esc.reason} - ${esc.event_mentioned}`,
          });
        });

        setAlertas(newAlertas.slice(0, 6));

        // Build funciones próximas from real events + zones
        const funcionesData = events.slice(0, 5).map((event, idx) => {
          const eventZones = zones.filter((z) => z.event_id === event.id);
          const sold = eventZones.reduce((s, z) => s + z.sold, 0);
          const total = eventZones.reduce((s, z) => s + z.available + z.sold, 0);
          const ocupacion = total > 0 ? Math.round((sold / total) * 100) : 0;
          const available = eventZones.reduce((s, z) => s + z.available, 0);

          return {
            id: idx + 1,
            nombre: event.name,
            hora: event.dates || 'TBD',
            sala: event.venue,
            ocupacion,
            available,
            image_url: event.image_url || '',
          };
        });

        setFuncionesProximas(funcionesData);

        // Build actividad reciente from real checkins + orders
        const actividades: Actividad[] = [];

        checkins.slice(0, 5).forEach((checkin) => {
          actividades.push({
            id: `checkin-${checkin.id}`,
            tipo: 'checkin',
            mensaje: `Check-in: ${checkin.customer_name} → ${checkin.event_name}`,
            tiempo: formatTimeAgo(checkin.scanned_at),
          });
        });

        orders.slice(0, 5).forEach((order) => {
          const event = eventMap.get(order.event_id);
          actividades.push({
            id: `order-${order.order_number}`,
            tipo: 'venta',
            mensaje: `Venta: ${order.customer_name} - ${event?.name || order.event_id}`,
            tiempo: formatTimeAgo(order.purchased_at),
          });
        });

        setActividadReciente(actividades.slice(0, 10));

        // Build clientes recientes from real data
        const clientesData: ClienteDisplay[] = customers.slice(0, 3).map((c) => ({
          id: c.id,
          nombre: c.name,
          email: c.email,
          ordenes: c.total_orders,
          gastado: c.total_spent,
          boletos: c.total_orders * 2,
        }));

        setClientes(clientesData);
        setLoading(false);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Error conectando con Supabase. Verifica tu conexión.');
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonMetrics />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-red-500">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="text-sm font-medium">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-3 text-xs text-[#E63946] hover:underline">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Metrics - real data */}
      <HeroMetrics
        revenue={metrics.revenue}
        tickets={metrics.tickets}
        occupancy={metrics.occupancy}
        upcoming={metrics.upcoming}
      />

      {/* Funciones Próximas + Alertas */}
      <div className="section-card">
        <div className="section-card-header !py-3">
          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="section-card-title">Funciones Próximas</span>
          {alertas.filter(a => a.tipo === 'critico').length > 0 && (
            <span className="badge badge-error ml-auto">{alertas.filter(a => a.tipo === 'critico').length} alertas</span>
          )}
        </div>
        {funcionesProximas.length === 0 ? (
          <EmptyState message="No hay funciones próximas registradas" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {funcionesProximas.map((funcion) => {
              const hasAlert = alertas.some(a => a.mensaje.toLowerCase().includes(funcion.nombre.toLowerCase()));
              return (
                <div key={funcion.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${hasAlert ? 'border-red-200 bg-red-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
                  {funcion.image_url ? (
                    <img src={funcion.image_url} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400">🎭</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {hasAlert && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                      <p className="font-semibold text-gray-900 text-sm truncate">{funcion.nombre}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{funcion.hora} · {funcion.sala}</p>
                    <p className={`text-xs mt-1 font-medium ${funcion.available < 50 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {funcion.available} boletos disponibles
                    </p>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${funcion.ocupacion >= 80 ? 'text-red-500' : funcion.ocupacion >= 50 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {funcion.ocupacion}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clientes Recientes + Actividad Reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clientes Recientes */}
        <div className="section-card flex flex-col">
          <div className="section-card-header !py-3">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="section-card-title">Clientes Recientes</span>
          </div>
          {clientes.length === 0 ? (
            <EmptyState message="Sin clientes registrados" />
          ) : (
            <div className="flex-1 divide-y divide-gray-50">
              {clientes.map((cliente) => (
                <div key={cliente.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[#E63946] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {cliente.nombre.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{cliente.nombre}</p>
                    <p className="text-xs text-gray-500">{cliente.ordenes} órdenes · ${cliente.gastado.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actividad Reciente */}
        <div className="section-card flex flex-col lg:col-span-2">
          <div className="section-card-header !py-3">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="section-card-title">Actividad Reciente</span>
          </div>
          {actividadReciente.length === 0 ? (
            <EmptyState message="Sin actividad reciente" />
          ) : (
            <div className="flex-1 divide-y divide-gray-50">
              {actividadReciente.map((actividad) => (
                <div key={actividad.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  <span className="text-sm flex-shrink-0">{getActividadEmoji(actividad.tipo)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{actividad.mensaje}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">{actividad.tiempo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
