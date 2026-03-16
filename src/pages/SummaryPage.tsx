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

const mockMetrics = {
  revenue: {
    label: 'Ingresos del Mes',
    value: '$1,245,890 MXN',
    trend: { value: 12.5, isPositive: true },
    sparkline: [65, 78, 52, 91, 83],
  },
  tickets: {
    label: 'Boletos Vendidos',
    value: '8,432',
    trend: { value: 8.3, isPositive: true },
    sparkline: [45, 62, 78, 55, 89],
  },
  occupancy: {
    label: 'Ocupación Promedio',
    value: '76%',
    trend: { value: 3.2, isPositive: false },
    sparkline: [82, 75, 79, 71, 76],
  },
  upcoming: {
    label: 'Funciones Próximas',
    value: '24',
    trend: { value: 15.0, isPositive: true },
    sparkline: [18, 22, 19, 25, 24],
  },
};

const mockAlertas: Alerta[] = [
  { id: 1, tipo: 'critico', mensaje: 'Función "Romeo y Julieta" 18:00 - Solo quedan 5 lugares disponibles' },
  { id: 2, tipo: 'critico', mensaje: 'Error en terminal de pago #3 - Requiere atención inmediata' },
  { id: 3, tipo: 'warning', mensaje: 'Stock bajo de boletos impresos para Sala Principal' },
  { id: 4, tipo: 'info', mensaje: 'Reporte semanal listo para revisión' },
];

const mockFuncionesProximas = [
  { id: 1, nombre: 'Romeo y Julieta', hora: '18:00', sala: 'Sala Principal', ocupacion: 95, image_url: '' },
  { id: 2, nombre: 'El Fantasma de la Ópera', hora: '19:30', sala: 'Sala A', ocupacion: 78, image_url: '' },
  { id: 3, nombre: 'Los Miserables', hora: '20:00', sala: 'Sala B', ocupacion: 45, image_url: '' },
  { id: 4, nombre: 'Cats', hora: '20:30', sala: 'Sala Principal', ocupacion: 62, image_url: '' },
  { id: 5, nombre: 'Chicago', hora: '21:00', sala: 'Sala C', ocupacion: 28, image_url: '' },
];

const mockActividadReciente = [
  { id: 1, tipo: 'venta', mensaje: 'Venta de 4 boletos - Romeo y Julieta', tiempo: 'Hace 2 min' },
  { id: 2, tipo: 'reembolso', mensaje: 'Reembolso procesado - $450 MXN', tiempo: 'Hace 5 min' },
  { id: 3, tipo: 'venta', mensaje: 'Venta de 2 boletos - El Fantasma de la Ópera', tiempo: 'Hace 8 min' },
  { id: 4, tipo: 'reservacion', mensaje: 'Nueva reservación grupal - 15 personas', tiempo: 'Hace 12 min' },
  { id: 5, tipo: 'venta', mensaje: 'Venta de 6 boletos - Los Miserables', tiempo: 'Hace 15 min' },
];

const mockClientes = [
  { id: '1', nombre: 'María González Hernández', email: 'maria.gonzalez@gmail.com', ordenes: 12, gastado: 8450, boletos: 28 },
  { id: '2', nombre: 'Carlos Ramírez López', email: 'carlos.ramirez@hotmail.com', ordenes: 8, gastado: 5200, boletos: 16 },
  { id: '3', nombre: 'Ana Martínez Sánchez', email: 'ana.martinez@outlook.com', ordenes: 5, gastado: 3100, boletos: 10 },
];

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

export default function SummaryPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(mockMetrics);
  const [alertas, setAlertas] = useState<Alerta[]>(mockAlertas);
  const [funcionesProximas, setFuncionesProximas] = useState(mockFuncionesProximas);
  const [actividadReciente, setActividadReciente] = useState<Actividad[]>(
    mockActividadReciente.map((a) => ({ ...a, id: String(a.id) }))
  );
  const [clientes, setClientes] = useState<ClienteDisplay[]>(mockClientes);

  useEffect(() => {
    async function loadData() {
      try {
        const [events, zones, orders, customers, checkins, escalations] = await Promise.all([
          fetchEvents(),
          fetchZones(),
          fetchOrders(),
          fetchCustomers(),
          fetchCheckins(),
          fetchEscalations(),
        ]);

        // Calculate metrics - use zones for revenue since orders may be empty
        const totalRevenue = zones.reduce((sum, zone) => sum + (zone.sold * zone.price), 0);
        const totalTickets = zones.reduce((sum, zone) => sum + zone.sold, 0);
        const totalAvailable = zones.reduce((sum, zone) => sum + zone.available + zone.sold, 0);
        const occupancy = totalAvailable > 0 ? Math.round((totalTickets / totalAvailable) * 100) : 0;
        const upcomingCount = events.length;

        setMetrics({
          revenue: {
            label: 'Ingresos del Mes',
            value: `$${totalRevenue.toLocaleString()} MXN`,
            trend: { value: 12.5, isPositive: true },
            sparkline: [65, 78, 52, 91, 83],
          },
          tickets: {
            label: 'Boletos Vendidos',
            value: totalTickets.toLocaleString(),
            trend: { value: 8.3, isPositive: true },
            sparkline: [45, 62, 78, 55, 89],
          },
          occupancy: {
            label: 'Ocupación Promedio',
            value: `${occupancy}%`,
            trend: { value: 3.2, isPositive: occupancy >= 70 },
            sparkline: [82, 75, 79, 71, occupancy],
          },
          upcoming: {
            label: 'Funciones Próximas',
            value: String(upcomingCount),
            trend: { value: 15.0, isPositive: true },
            sparkline: [18, 22, 19, 25, upcomingCount],
          },
        });

        // Build alerts from zones with low availability
        const newAlertas: Alerta[] = [];
        const eventMap = new Map(events.map((e) => [e.id, e]));

        zones.forEach((zone, idx) => {
          if (zone.available < 50) {
            const event = eventMap.get(zone.event_id);
            const eventName = event?.name || zone.event_id;
            newAlertas.push({
              id: `zone-${idx}`,
              tipo: zone.available < 50 ? 'critico' : 'warning',
              mensaje: `${eventName} - ${zone.zone_name}: Solo quedan ${zone.available} lugares disponibles`,
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

        // Add escalations as alerts
        escalations.forEach((esc, idx) => {
          newAlertas.push({
            id: `esc-${idx}`,
            tipo: 'critico',
            mensaje: `Escalación: ${esc.reason} - ${esc.event_mentioned}`,
          });
        });

        if (newAlertas.length > 0) {
          setAlertas(newAlertas.slice(0, 6));
        }

        // Build funciones próximas from events + zones
        const funcionesData = events.slice(0, 5).map((event, idx) => {
          const eventZones = zones.filter((z) => z.event_id === event.id);
          const sold = eventZones.reduce((s, z) => s + z.sold, 0);
          const total = eventZones.reduce((s, z) => s + z.available + z.sold, 0);
          const ocupacion = total > 0 ? Math.round((sold / total) * 100) : 0;

          return {
            id: idx + 1,
            nombre: event.name,
            hora: event.dates || 'TBD',
            sala: event.venue,
            ocupacion,
            image_url: event.image_url || '',
          };
        });

        if (funcionesData.length > 0) {
          setFuncionesProximas(funcionesData);
        }

        // Build actividad reciente from checkins + orders
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

        // Sort by time (most recent first) - approximated by order in arrays
        if (actividades.length > 0) {
          setActividadReciente(actividades.slice(0, 10));
        }

        // Build clientes recientes
        const clientesData: ClienteDisplay[] = customers.slice(0, 3).map((c) => ({
          id: c.id,
          nombre: c.name,
          email: c.email,
          ordenes: c.total_orders,
          gastado: c.total_spent,
          boletos: c.total_orders * 2, // Estimate
        }));

        if (clientesData.length > 0) {
          setClientes(clientesData);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Keep mock data as fallback
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

  return (
    <div className="space-y-6">
      {/* Hero Metrics - Cellosa style cards */}
      <HeroMetrics
        revenue={metrics.revenue}
        tickets={metrics.tickets}
        occupancy={metrics.occupancy}
        upcoming={metrics.upcoming}
      />

      {/* Alertas Section - compact */}
      {alertas.length > 0 && (
        <div className="section-card">
          <div className="section-card-header !py-3">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="section-card-title">Alertas</span>
            <span className="badge badge-error ml-auto">{alertas.filter(a => a.tipo === 'critico').length} críticas</span>
          </div>
          <div className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {alertas.map((alerta) => (
                <div key={alerta.id} className={`flex items-center gap-2 py-1.5 px-2.5 rounded-md text-xs ${
                  alerta.tipo === "critico" ? "bg-red-50" : alerta.tipo === "warning" ? "bg-amber-50" : "bg-blue-50"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    alerta.tipo === "critico" ? "bg-red-500" : alerta.tipo === "warning" ? "bg-amber-500" : "bg-blue-500"
                  }`} />
                  <span className="text-gray-700 truncate">{alerta.mensaje}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout for Funciones and Actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funciones Próximas - compact list */}
        <div className="section-card flex flex-col">
          <div className="section-card-header !py-3">
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="section-card-title">Funciones Próximas</span>
          </div>
          <div className="flex-1 divide-y divide-gray-100">
            {funcionesProximas.map((funcion) => (
              <div key={funcion.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                {funcion.image_url ? (
                  <img src={funcion.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-400 text-xs">🎭</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{funcion.nombre}</p>
                  <p className="text-xs text-gray-500">{funcion.hora} · {funcion.sala}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getOcupacionColor(funcion.ocupacion)} rounded-full`}
                      style={{ width: `${funcion.ocupacion}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold w-8 text-right ${funcion.ocupacion >= 80 ? 'text-red-500' : 'text-gray-600'}`}>
                    {funcion.ocupacion}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actividad Reciente - match height */}
        <div className="section-card flex flex-col">
          <div className="section-card-header !py-3">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="section-card-title">Actividad Reciente</span>
          </div>
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
            {actividadReciente.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-8 text-gray-400 text-sm">
                Sin actividad reciente
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clientes Recientes - card grid instead of table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Clientes Recientes
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {clientes.map((cliente) => (
            <div key={cliente.id} className="section-card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#E63946] flex items-center justify-center text-white font-semibold">
                  {cliente.nombre.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{cliente.nombre}</p>
                  <p className="text-xs text-gray-500 truncate">{cliente.email}</p>
                </div>
              </div>
              <div className="text-xs text-gray-600">
                {cliente.ordenes} órdenes · ${cliente.gastado.toLocaleString()} gastado · {cliente.boletos} boletos
              </div>
              <button
                onClick={() => alert(`Detalle de ${cliente.nombre}`)}
                className="text-xs text-[#E63946] hover:underline mt-2 font-medium"
              >
                Ver detalle
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
