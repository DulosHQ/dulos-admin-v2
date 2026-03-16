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
  { id: 1, nombre: 'Romeo y Julieta', hora: '18:00', sala: 'Sala Principal', ocupacion: 95 },
  { id: 2, nombre: 'El Fantasma de la Ópera', hora: '19:30', sala: 'Sala A', ocupacion: 78 },
  { id: 3, nombre: 'Los Miserables', hora: '20:00', sala: 'Sala B', ocupacion: 45 },
  { id: 4, nombre: 'Cats', hora: '20:30', sala: 'Sala Principal', ocupacion: 62 },
  { id: 5, nombre: 'Chicago', hora: '21:00', sala: 'Sala C', ocupacion: 28 },
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

function getActividadColor(tipo: string): string {
  switch (tipo) {
    case 'venta':
      return 'bg-green-500';
    case 'reembolso':
      return 'bg-orange-500';
    case 'reservacion':
      return 'bg-blue-500';
    case 'cancelacion':
      return 'bg-red-500';
    case 'checkin':
      return 'bg-purple-500';
    default:
      return 'bg-gray-500';
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="space-y-3">
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        <div className="h-3 bg-gray-200 rounded w-4/6"></div>
      </div>
    </div>
  );
}

function SkeletonMetrics() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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

        // Calculate metrics
        const totalRevenue = orders.reduce((sum, order) => sum + order.total_price, 0);
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
            mensaje: `Check-in: ${checkin.customer_name} - ${checkin.event_name}`,
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
      <div className="min-h-screen bg-[#f8f6f6] p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>
            <p className="text-gray-500 mt-1">Resumen de operaciones de boletería</p>
          </div>
          <SkeletonMetrics />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f6] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>
          <p className="text-gray-500 mt-1">Resumen de operaciones de boletería</p>
        </div>

        <HeroMetrics
          revenue={metrics.revenue}
          tickets={metrics.tickets}
          occupancy={metrics.occupancy}
          upcoming={metrics.upcoming}
        />

        {/* Sección de Alertas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Alertas</h2>
          <div className="space-y-3">
            {alertas.map((alerta) => (
              <div
                key={alerta.id}
                className={`p-4 rounded-lg ${
                  alerta.tipo === 'critico'
                    ? 'bg-red-50 border border-red-200'
                    : alerta.tipo === 'warning'
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}
              >
                <p
                  className={`text-sm ${
                    alerta.tipo === 'critico'
                      ? 'text-red-800'
                      : alerta.tipo === 'warning'
                      ? 'text-yellow-800'
                      : 'text-blue-800'
                  }`}
                >
                  {alerta.mensaje}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Sección de Funciones Próximas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Funciones Próximas</h2>
          <div className="space-y-4">
            {funcionesProximas.map((funcion) => (
              <div key={funcion.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{funcion.nombre}</p>
                  <p className="text-sm text-gray-500">
                    {funcion.hora} • {funcion.sala}
                  </p>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-48">
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getOcupacionColor(funcion.ocupacion)} rounded-full`}
                      style={{ width: `${funcion.ocupacion}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-12 text-right">
                    {funcion.ocupacion}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sección de Actividad Reciente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actividad Reciente</h2>
          <div className="space-y-3">
            {actividadReciente.map((actividad) => (
              <div key={actividad.id} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${getActividadColor(actividad.tipo)}`} />
                <p className="flex-1 text-sm text-gray-700">{actividad.mensaje}</p>
                <span className="text-xs text-gray-400">{actividad.tiempo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sección de Clientes Recientes */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Clientes Recientes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {clientes.map((cliente) => (
              <div key={cliente.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-full bg-[#E63946] text-white w-10 h-10 flex items-center justify-center font-bold">
                    {cliente.nombre.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{cliente.nombre}</p>
                    <p className="text-gray-500 text-sm">{cliente.email}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{cliente.ordenes} órdenes · ${cliente.gastado.toLocaleString()} gastado · {cliente.boletos} boletos</p>
                <button onClick={() => alert(`Detalle de ${cliente.nombre}`)} className="text-sm text-[#E63946]">Ver detalle</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
