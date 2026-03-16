'use client';

import React, { useState, useEffect } from 'react';
import {
  fetchAllEvents,
  fetchZones,
  fetchAllOrders,
  fetchSchedules,
  DulosEvent,
  TicketZone,
  Order,
  Schedule,
} from '../lib/supabase';

interface ProjectDisplay {
  id: string;
  name: string;
  producer: string;
  status: 'PUBLICADO' | 'BORRADOR' | 'ARCHIVADO';
  events: EventDisplay[];
}

interface EventDisplay {
  id: string;
  name: string;
  venue: string;
  date: string;
  ticketsSold: number;
  totalTickets: number;
  revenue: number;
  zones: ZoneDisplay[];
  schedules: ScheduleDisplay[];
  orders: OrderDisplay[];
}

interface ZoneDisplay {
  id: string;
  nombre: string;
  precio: number;
  capacidad: number;
  vendidos: number;
}

interface ScheduleDisplay {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  activa: boolean;
  vendidos: number;
}

interface OrderDisplay {
  id: string;
  cliente: string;
  email: string;
  zona: string;
  cantidad: number;
  total: number;
  estado: 'Completado' | 'Pendiente' | 'Reembolsado';
  fecha: string;
}

const getStatusColor = (status: ProjectDisplay['status']) => {
  switch (status) {
    case 'PUBLICADO':
      return 'bg-green-500';
    case 'BORRADOR':
      return 'bg-gray-500';
    case 'ARCHIVADO':
      return 'bg-red-500';
  }
};

const getOccupancyColor = (percentage: number) => {
  if (percentage < 50) return 'bg-green-500';
  if (percentage <= 80) return 'bg-yellow-500';
  return 'bg-red-500';
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'TBD';
  return dateStr;
};

const getOrderStatusColor = (estado: OrderDisplay['estado']) => {
  switch (estado) {
    case 'Completado': return 'bg-green-500';
    case 'Pendiente': return 'bg-yellow-500';
    case 'Reembolsado': return 'bg-gray-500';
  }
};

const mapPaymentStatus = (status: string): OrderDisplay['estado'] => {
  if (status === 'paid' || status === 'completed') return 'Completado';
  if (status === 'refunded') return 'Reembolsado';
  return 'Pendiente';
};

function SkeletonRow() {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-md animate-pulse">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
          <div>
            <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="h-6 bg-gray-200 rounded w-20"></div>
          <div className="text-right">
            <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectDisplay[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderDisplay | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [events, zones, orders, schedules] = await Promise.all([
          fetchAllEvents().catch(() => []),
          fetchZones().catch(() => []),
          fetchAllOrders().catch(() => []),
          fetchSchedules().catch(() => []),
        ]);

        // Group events by name (project)
        const projectMap = new Map<string, DulosEvent[]>();
        events.forEach((event) => {
          const projectName = event.name.split(' - ')[0] || event.name;
          if (!projectMap.has(projectName)) {
            projectMap.set(projectName, []);
          }
          projectMap.get(projectName)!.push(event);
        });

        // Build project display data
        const projectsData: ProjectDisplay[] = Array.from(projectMap.entries()).map(([name, projectEvents]) => {
          const eventsDisplay: EventDisplay[] = projectEvents.map((event) => {
            const eventZones = zones.filter((z) => z.event_id === event.id);
            const eventOrders = orders.filter((o) => o.event_id === event.id);
            const eventSchedules = schedules.filter((s) => s.event_id === event.id);

            const ticketsSold = eventZones.reduce((sum, z) => sum + z.sold, 0);
            const totalTickets = eventZones.reduce((sum, z) => sum + z.available + z.sold, 0);
            const revenue = eventZones.reduce((sum, z) => sum + (z.sold * z.price), 0);

            return {
              id: event.id,
              name: event.name,
              venue: event.venue,
              date: event.dates,
              ticketsSold,
              totalTickets,
              revenue,
              zones: eventZones.map((z, idx) => ({
                id: `zone-${idx}`,
                nombre: z.zone_name,
                precio: z.price,
                capacidad: z.available + z.sold,
                vendidos: z.sold,
              })),
              schedules: eventSchedules.map((s) => ({
                id: s.id,
                fecha: s.date,
                horaInicio: s.start_time,
                horaFin: s.end_time,
                activa: s.status === 'active',
                vendidos: s.sold_capacity,
              })),
              orders: eventOrders.slice(0, 10).map((o) => ({
                id: o.order_number,
                cliente: o.customer_name,
                email: o.customer_email,
                zona: o.zone_name,
                cantidad: o.quantity,
                total: o.total_price,
                estado: mapPaymentStatus(o.payment_status),
                fecha: o.purchased_at,
              })),
            };
          });

          const status: ProjectDisplay['status'] =
            projectEvents.some((e) => e.status === 'active') ? 'PUBLICADO' :
            projectEvents.some((e) => e.status === 'draft') ? 'BORRADOR' : 'ARCHIVADO';

          return {
            id: name,
            name,
            producer: 'Dulos Entertainment',
            status,
            events: eventsDisplay,
          };
        });

        setProjects(projectsData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading events:', error);
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const toggleEventExpand = (id: string) => {
    setExpandedEventIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.producer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProjectTotals = (project: ProjectDisplay) => {
    const totalRevenue = project.events.reduce((sum, e) => sum + e.revenue, 0);
    const eventCount = project.events.length;
    return { totalRevenue, eventCount };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f6] py-8">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold text-gray-900">EVENTOS</h1>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f6] py-8">
      <div className="mx-auto max-w-[1200px] px-6">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">EVENTOS</h1>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Buscar proyectos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:border-[#E63946] focus:outline-none focus:ring-1 focus:ring-[#E63946]"
            />
            <button
              onClick={() => alert('Crear nuevo proyecto')}
              className="rounded-lg bg-[#E63946] px-4 py-2 font-medium text-white transition-colors hover:bg-[#c5303c]"
            >
              + Nuevo Proyecto
            </button>
          </div>
        </div>

        {/* Project Cards */}
        <div className="space-y-4">
          {filteredProjects.map((project) => {
            const isExpanded = expandedIds.includes(project.id);
            const { totalRevenue, eventCount } = getProjectTotals(project);

            return (
              <div
                key={project.id}
                className="overflow-hidden rounded-lg bg-white shadow-md"
              >
                {/* Card Header (clickable) */}
                <div
                  onClick={() => toggleExpand(project.id)}
                  className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-[#f8f6f6]"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    >
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-500">{project.producer}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium text-white ${getStatusColor(project.status)}`}
                    >
                      {project.status}
                    </span>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(totalRevenue)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {eventCount} evento{eventCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-[#f8f6f6]">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                            <th className="px-4 py-3 font-medium">Evento</th>
                            <th className="px-4 py-3 font-medium">Fecha</th>
                            <th className="px-4 py-3 font-medium">Ocupacion</th>
                            <th className="px-4 py-3 font-medium">Revenue</th>
                            <th className="px-4 py-3 font-medium">Boletos</th>
                            <th className="px-4 py-3 font-medium">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {project.events.map((event) => {
                            const occupancy = event.totalTickets > 0
                              ? (event.ticketsSold / event.totalTickets) * 100
                              : 0;
                            return (
                              <React.Fragment key={event.id}>
                              <tr
                                className="border-b border-gray-200 last:border-b-0"
                              >
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {event.name}
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {formatDate(event.date)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                                      <div
                                        className={`h-full ${getOccupancyColor(occupancy)}`}
                                        style={{ width: `${occupancy}%` }}
                                      />
                                    </div>
                                    <span className="text-sm text-gray-600">
                                      {occupancy.toFixed(0)}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {formatCurrency(event.revenue)}
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {event.ticketsSold.toLocaleString()} /{' '}
                                  {event.totalTickets.toLocaleString()}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleEventExpand(event.id); }}
                                      className="rounded-md bg-[#E63946] px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-[#c5303c]"
                                    >
                                      {expandedEventIds.includes(event.id) ? 'Cerrar' : 'Detalles'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {expandedEventIds.includes(event.id) && (
                                <tr><td colSpan={6} className="bg-white p-4">
                                  <div className="space-y-6">
                                    {/* Ordenes Recientes */}
                                    <div className="rounded-xl bg-white border border-gray-200 p-4">
                                      <h4 className="font-semibold text-gray-900 mb-3">Ordenes recientes</h4>
                                      {event.orders.length > 0 ? (
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-sm">
                                            <thead><tr className="text-left text-gray-500 border-b">
                                              <th className="pb-2"># Orden</th><th className="pb-2">Cliente</th><th className="pb-2 hidden sm:table-cell">Email</th><th className="pb-2">Zona</th><th className="pb-2">Cant.</th><th className="pb-2">Total</th><th className="pb-2">Estado</th><th className="pb-2 hidden sm:table-cell">Fecha</th>
                                            </tr></thead>
                                            <tbody>
                                              {event.orders.map((o) => (
                                                <tr key={o.id} onClick={() => setSelectedOrder(o)} className="border-b cursor-pointer hover:bg-gray-50">
                                                  <td className="py-2 text-[#E63946] font-medium">{o.id}</td><td className="py-2">{o.cliente}</td><td className="py-2 hidden sm:table-cell">{o.email}</td><td className="py-2">{o.zona}</td><td className="py-2">{o.cantidad}</td><td className="py-2">{formatCurrency(o.total)}</td><td className="py-2"><span className={`text-white text-xs px-2 py-0.5 rounded-full ${getOrderStatusColor(o.estado)}`}>{o.estado}</span></td><td className="py-2 hidden sm:table-cell">{formatDate(o.fecha)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <p className="text-gray-500 text-sm">No hay ordenes para este evento</p>
                                      )}
                                    </div>
                                    {/* Zonas */}
                                    <div className="rounded-xl bg-white border border-gray-200 p-4">
                                      <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-semibold text-gray-900">Zonas</h4>
                                        <button onClick={() => alert('Agregar zona')} className="text-sm text-[#E63946] font-medium hover:underline">+ Agregar Zona</button>
                                      </div>
                                      {event.zones.length > 0 ? (
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                          {event.zones.map((z) => {
                                            const pct = z.capacidad > 0 ? (z.vendidos / z.capacidad) * 100 : 0;
                                            return (
                                              <div key={z.id} className="border rounded-lg p-3">
                                                <div className="flex justify-between items-center mb-2"><span className="font-medium">{z.nombre}</span><button onClick={() => alert('Editar zona: ' + z.nombre)} className="text-xs text-[#E63946] hover:underline">Editar</button></div>
                                                <p className="text-sm text-gray-600">{formatCurrency(z.precio)}</p>
                                                <div className="flex items-center gap-2 mt-2"><div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full ${getOccupancyColor(pct)}`} style={{ width: `${pct}%` }} /></div><span className="text-xs text-gray-500">{z.vendidos}/{z.capacidad}</span></div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-gray-500 text-sm">No hay zonas configuradas</p>
                                      )}
                                    </div>
                                    {/* Funciones */}
                                    <div className="rounded-xl bg-white border border-gray-200 p-4">
                                      <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-semibold text-gray-900">Funciones</h4>
                                        <button onClick={() => alert('Agregar funcion')} className="text-sm text-[#E63946] font-medium hover:underline">+ Agregar Funcion</button>
                                      </div>
                                      {event.schedules.length > 0 ? (
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-sm">
                                            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Fecha</th><th className="pb-2">Hora inicio</th><th className="pb-2">Hora fin</th><th className="pb-2">Estado</th><th className="pb-2">Vendidos</th></tr></thead>
                                            <tbody>
                                              {event.schedules.map((f) => (
                                                <tr key={f.id} className="border-b last:border-0">
                                                  <td className="py-2">{f.fecha}</td><td className="py-2">{f.horaInicio}</td><td className="py-2">{f.horaFin}</td>
                                                  <td className="py-2"><button onClick={() => alert('Toggle estado funcion')} className={`w-10 h-5 rounded-full relative ${f.activa ? 'bg-[#E63946]' : 'bg-gray-300'}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${f.activa ? 'right-0.5' : 'left-0.5'}`} /></button></td>
                                                  <td className="py-2">{f.vendidos}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <p className="text-gray-500 text-sm">No hay funciones programadas</p>
                                      )}
                                    </div>
                                  </div>
                                </td></tr>
                              )}
                            </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {/* Modal Orden */}
                {selectedOrder && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-between items-center mb-4"><h3 className="font-semibold text-lg">Orden {selectedOrder.id}</h3><button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700">X</button></div>
                      <div className="space-y-3 text-sm">
                        <p><span className="text-gray-500">Cliente:</span> {selectedOrder.cliente}</p>
                        <p><span className="text-gray-500">Email:</span> {selectedOrder.email}</p>
                        <p><span className="text-gray-500">Zona:</span> {selectedOrder.zona}</p>
                        <p><span className="text-gray-500">Total:</span> {formatCurrency(selectedOrder.total)}</p>
                        <p><span className="text-gray-500">Estado:</span> <span className={`text-white text-xs px-2 py-0.5 rounded-full ${getOrderStatusColor(selectedOrder.estado)}`}>{selectedOrder.estado}</span></p>
                      </div>
                      <button onClick={() => { alert('Procesar reembolso'); setSelectedOrder(null); }} className="mt-4 w-full bg-[#E63946] text-white py-2 rounded-lg font-medium hover:bg-[#c5303c]">Procesar Reembolso</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && !loading && (
          <div className="rounded-lg bg-white p-8 text-center shadow-md">
            <p className="text-gray-500">No se encontraron proyectos</p>
          </div>
        )}
      </div>
    </div>
  );
}
