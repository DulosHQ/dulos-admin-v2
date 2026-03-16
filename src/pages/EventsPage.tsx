'use client';

import React, { useState } from 'react';

interface Event {
  id: string;
  name: string;
  date: string;
  ticketsSold: number;
  totalTickets: number;
  revenue: number;
}

interface Order {
  id: string;
  cliente: string;
  email: string;
  zona: string;
  cantidad: number;
  total: number;
  estado: 'Completado' | 'Pendiente' | 'Reembolsado';
  fecha: string;
  boletos: { codigo: string; asiento: string }[];
}

interface Zona {
  id: string;
  nombre: string;
  precio: number;
  capacidad: number;
  vendidos: number;
}

interface Funcion {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  activa: boolean;
  vendidos: number;
}

const mockOrders: Order[] = [
  { id: 'ORD-001', cliente: 'María García', email: 'maria@email.com', zona: 'VIP', cantidad: 2, total: 3500, estado: 'Completado', fecha: '2024-03-10', boletos: [{ codigo: 'TKT-001', asiento: 'A1' }, { codigo: 'TKT-002', asiento: 'A2' }] },
  { id: 'ORD-002', cliente: 'Juan Pérez', email: 'juan@email.com', zona: 'General', cantidad: 4, total: 2000, estado: 'Completado', fecha: '2024-03-09', boletos: [{ codigo: 'TKT-003', asiento: 'G15' }, { codigo: 'TKT-004', asiento: 'G16' }, { codigo: 'TKT-005', asiento: 'G17' }, { codigo: 'TKT-006', asiento: 'G18' }] },
  { id: 'ORD-003', cliente: 'Ana López', email: 'ana@email.com', zona: 'Preferente', cantidad: 1, total: 1200, estado: 'Pendiente', fecha: '2024-03-08', boletos: [{ codigo: 'TKT-007', asiento: 'P22' }] },
  { id: 'ORD-004', cliente: 'Carlos Ruiz', email: 'carlos@email.com', zona: 'VIP', cantidad: 3, total: 5250, estado: 'Reembolsado', fecha: '2024-03-07', boletos: [{ codigo: 'TKT-008', asiento: 'A5' }, { codigo: 'TKT-009', asiento: 'A6' }, { codigo: 'TKT-010', asiento: 'A7' }] },
];

const mockZonas: Zona[] = [
  { id: 'z1', nombre: 'VIP', precio: 1750, capacidad: 100, vendidos: 85 },
  { id: 'z2', nombre: 'Preferente', precio: 1200, capacidad: 200, vendidos: 150 },
  { id: 'z3', nombre: 'General', precio: 500, capacidad: 200, vendidos: 120 },
];

const mockFunciones: Funcion[] = [
  { id: 'f1', fecha: '2024-03-15', horaInicio: '19:00', horaFin: '21:30', activa: true, vendidos: 320 },
  { id: 'f2', fecha: '2024-03-16', horaInicio: '17:00', horaFin: '19:30', activa: true, vendidos: 180 },
  { id: 'f3', fecha: '2024-03-16', horaInicio: '21:00', horaFin: '23:30', activa: false, vendidos: 50 },
];

interface Project {
  id: string;
  name: string;
  producer: string;
  status: 'PUBLICADO' | 'BORRADOR' | 'ARCHIVADO';
  events: Event[];
}

const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Así Lo Veo Yo',
    producer: 'Dulos Entertainment',
    status: 'PUBLICADO',
    events: [
      { id: '1a', name: 'Así Lo Veo Yo - Teatro Diana', date: '2024-03-15', ticketsSold: 450, totalTickets: 500, revenue: 225000 },
      { id: '1b', name: 'Así Lo Veo Yo - Auditorio Nacional', date: '2024-03-22', ticketsSold: 2800, totalTickets: 10000, revenue: 1400000 },
    ],
  },
  {
    id: '2',
    name: 'Infierno',
    producer: 'Dulos Entertainment',
    status: 'PUBLICADO',
    events: [
      { id: '2a', name: 'Infierno - Foro Sol', date: '2024-04-10', ticketsSold: 35000, totalTickets: 65000, revenue: 17500000 },
    ],
  },
  {
    id: '3',
    name: 'Oh Karen',
    producer: 'Dulos Entertainment',
    status: 'BORRADOR',
    events: [
      { id: '3a', name: 'Oh Karen - Teatro Metropólitan', date: '2024-05-01', ticketsSold: 0, totalTickets: 3000, revenue: 0 },
    ],
  },
  {
    id: '4',
    name: 'Lucero',
    producer: 'Dulos Entertainment',
    status: 'PUBLICADO',
    events: [
      { id: '4a', name: 'Lucero - Arena Monterrey', date: '2024-04-28', ticketsSold: 12000, totalTickets: 17000, revenue: 6000000 },
      { id: '4b', name: 'Lucero - Arena CDMX', date: '2024-05-05', ticketsSold: 8500, totalTickets: 22000, revenue: 4250000 },
    ],
  },
  {
    id: '5',
    name: 'Maleficio',
    producer: 'Dulos Entertainment',
    status: 'ARCHIVADO',
    events: [
      { id: '5a', name: 'Maleficio - Palacio de los Deportes', date: '2023-10-31', ticketsSold: 18000, totalTickets: 20000, revenue: 9000000 },
    ],
  },
];

const getStatusColor = (status: Project['status']) => {
  switch (status) {
    case 'PUBLICADO':
      return 'bg-green-500';
    case 'BORRADOR':
      return 'bg-[#f8f6f6]0';
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
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getOrderStatusColor = (estado: Order['estado']) => {
  switch (estado) {
    case 'Completado': return 'bg-green-500';
    case 'Pendiente': return 'bg-yellow-500';
    case 'Reembolsado': return 'bg-gray-500';
  }
};

export default function EventsPage() {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const toggleEventExpand = (id: string) => {
    setExpandedEventIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredProjects = mockProjects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.producer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProjectTotals = (project: Project) => {
    const totalRevenue = project.events.reduce((sum, e) => sum + e.revenue, 0);
    const eventCount = project.events.length;
    return { totalRevenue, eventCount };
  };

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
                            <th className="px-4 py-3 font-medium">Ocupación</th>
                            <th className="px-4 py-3 font-medium">Revenue</th>
                            <th className="px-4 py-3 font-medium">Boletos</th>
                            <th className="px-4 py-3 font-medium">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {project.events.map((event) => {
                            const occupancy =
                              (event.ticketsSold / event.totalTickets) * 100;
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
                                    {/* Órdenes Recientes */}
                                    <div className="rounded-xl bg-white border border-gray-200 p-4">
                                      <h4 className="font-semibold text-gray-900 mb-3">Órdenes recientes</h4>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead><tr className="text-left text-gray-500 border-b">
                                            <th className="pb-2"># Orden</th><th className="pb-2">Cliente</th><th className="pb-2 hidden sm:table-cell">Email</th><th className="pb-2">Zona</th><th className="pb-2">Cant.</th><th className="pb-2">Total</th><th className="pb-2">Estado</th><th className="pb-2 hidden sm:table-cell">Fecha</th>
                                          </tr></thead>
                                          <tbody>
                                            {mockOrders.map((o) => (
                                              <tr key={o.id} onClick={() => setSelectedOrder(o)} className="border-b cursor-pointer hover:bg-gray-50">
                                                <td className="py-2 text-[#E63946] font-medium">{o.id}</td><td className="py-2">{o.cliente}</td><td className="py-2 hidden sm:table-cell">{o.email}</td><td className="py-2">{o.zona}</td><td className="py-2">{o.cantidad}</td><td className="py-2">{formatCurrency(o.total)}</td><td className="py-2"><span className={`text-white text-xs px-2 py-0.5 rounded-full ${getOrderStatusColor(o.estado)}`}>{o.estado}</span></td><td className="py-2 hidden sm:table-cell">{formatDate(o.fecha)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                    {/* Zonas */}
                                    <div className="rounded-xl bg-white border border-gray-200 p-4">
                                      <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-semibold text-gray-900">Zonas</h4>
                                        <button onClick={() => alert('Agregar zona')} className="text-sm text-[#E63946] font-medium hover:underline">+ Agregar Zona</button>
                                      </div>
                                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {mockZonas.map((z) => {
                                          const pct = (z.vendidos / z.capacidad) * 100;
                                          return (
                                            <div key={z.id} className="border rounded-lg p-3">
                                              <div className="flex justify-between items-center mb-2"><span className="font-medium">{z.nombre}</span><button onClick={() => alert('Editar zona: ' + z.nombre)} className="text-xs text-[#E63946] hover:underline">Editar</button></div>
                                              <p className="text-sm text-gray-600">{formatCurrency(z.precio)}</p>
                                              <div className="flex items-center gap-2 mt-2"><div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full ${getOccupancyColor(pct)}`} style={{ width: `${pct}%` }} /></div><span className="text-xs text-gray-500">{z.vendidos}/{z.capacidad}</span></div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    {/* Funciones */}
                                    <div className="rounded-xl bg-white border border-gray-200 p-4">
                                      <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-semibold text-gray-900">Funciones</h4>
                                        <button onClick={() => alert('Agregar función')} className="text-sm text-[#E63946] font-medium hover:underline">+ Agregar Función</button>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Fecha</th><th className="pb-2">Hora inicio</th><th className="pb-2">Hora fin</th><th className="pb-2">Estado</th><th className="pb-2">Vendidos</th></tr></thead>
                                          <tbody>
                                            {mockFunciones.map((f) => (
                                              <tr key={f.id} className="border-b last:border-0">
                                                <td className="py-2">{formatDate(f.fecha)}</td><td className="py-2">{f.horaInicio}</td><td className="py-2">{f.horaFin}</td>
                                                <td className="py-2"><button onClick={() => alert('Toggle estado función')} className={`w-10 h-5 rounded-full relative ${f.activa ? 'bg-[#E63946]' : 'bg-gray-300'}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${f.activa ? 'right-0.5' : 'left-0.5'}`} /></button></td>
                                                <td className="py-2">{f.vendidos}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
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

                    {/* Zonas y Órdenes del Proyecto */}
                    <div className="grid grid-cols-1 gap-4 p-4">
                      {/* Zonas */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-700">Zonas</h4>
                          <button onClick={() => alert('Agregar zona')} className="text-xs text-[#E63946] hover:underline">+ Zona</button>
                        </div>
                        <div className="space-y-2">
                          {[
                            { nombre: 'General', precio: 500, vendidos: 120, total: 200 },
                            { nombre: 'Preferente', precio: 1200, vendidos: 150, total: 200 },
                            { nombre: 'VIP', precio: 1750, vendidos: 85, total: 100 },
                          ].map((z) => {
                            const pct = (z.vendidos / z.total) * 100;
                            return (
                              <div key={z.nombre} className="flex items-center gap-3 text-sm">
                                <span className="w-20 font-medium text-gray-700">{z.nombre}</span>
                                <span className="w-16 text-gray-500">{formatCurrency(z.precio)}</span>
                                <span className="w-16 text-gray-500">{z.vendidos}/{z.total}</span>
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full ${getOccupancyColor(pct)}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Últimas Órdenes */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Últimas Órdenes</h4>
                        <div className="space-y-2">
                          {[
                            { orden: '#ORD-001', cliente: 'María García', monto: 3500, estado: 'Pagado' as const },
                            { orden: '#ORD-002', cliente: 'Juan Pérez', monto: 2000, estado: 'Pagado' as const },
                            { orden: '#ORD-003', cliente: 'Ana López', monto: 1200, estado: 'Pendiente' as const },
                          ].map((o) => (
                            <div key={o.orden} className="flex items-center gap-3 text-sm">
                              <span className="w-20 font-medium text-[#E63946]">{o.orden}</span>
                              <span className="flex-1 text-gray-700">{o.cliente}</span>
                              <span className="w-20 text-gray-500">{formatCurrency(o.monto)}</span>
                              <span className={`px-2 py-0.5 text-xs rounded-full text-white ${o.estado === 'Pagado' ? 'bg-green-500' : 'bg-yellow-500'}`}>{o.estado}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Modal Orden */}
                {selectedOrder && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-between items-center mb-4"><h3 className="font-semibold text-lg">Orden {selectedOrder.id}</h3><button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700">✕</button></div>
                      <div className="space-y-3 text-sm">
                        <p><span className="text-gray-500">Cliente:</span> {selectedOrder.cliente}</p>
                        <p><span className="text-gray-500">Email:</span> {selectedOrder.email}</p>
                        <p><span className="text-gray-500">Zona:</span> {selectedOrder.zona}</p>
                        <p><span className="text-gray-500">Total:</span> {formatCurrency(selectedOrder.total)}</p>
                        <p><span className="text-gray-500">Estado:</span> <span className={`text-white text-xs px-2 py-0.5 rounded-full ${getOrderStatusColor(selectedOrder.estado)}`}>{selectedOrder.estado}</span></p>
                        <div className="border-t pt-3 mt-3">
                          <p className="font-medium mb-2">Boletos:</p>
                          {selectedOrder.boletos.map((b) => <p key={b.codigo} className="text-gray-600">{b.codigo} - Asiento {b.asiento}</p>)}
                        </div>
                      </div>
                      <button onClick={() => { alert('Procesar reembolso'); setSelectedOrder(null); }} className="mt-4 w-full bg-[#E63946] text-white py-2 rounded-lg font-medium hover:bg-[#c5303c]">Procesar Reembolso</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="rounded-lg bg-white p-8 text-center shadow-md">
            <p className="text-gray-500">No se encontraron proyectos</p>
          </div>
        )}
      </div>
    </div>
  );
}
