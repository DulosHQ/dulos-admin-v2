'use client';

import React, { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  fetchAllEvents,
  fetchZones,
  fetchAllOrders,
  fetchSchedules,
  fetchProyectos,
  getVenueMap,
  getVenueName,
  getVenueCity,
  DulosEvent,
  TicketZone,
  Order,
  Schedule,
  Venue,
} from '../lib/supabase';
import { createEvent, updateEvent, archiveEvent } from '../app/actions/events.actions';

/* ─── Types ─── */

interface ProjectDisplay {
  id: string;
  name: string;
  producer: string;
  image_url: string;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' | 'FINALIZADO';
  events: EventDisplay[];
  isPast: boolean;
  revenue: number;
  commission: number;
  eventCount: number;
}

interface EventDisplay {
  id: string;
  name: string;
  venue: string;
  date: string;
  image_url: string;
  ticketsSold: number;
  totalTickets: number;
  revenue: number;
  zones: ZoneDisplay[];
  schedules: ScheduleDisplay[];
  orders: OrderDisplay[];
  ticketTypes: TicketTypeDisplay[];
}

interface ZoneDisplay {
  id: string;
  nombre: string;
  precio: number;
  capacidad: number;
  vendidos: number;
}

interface TicketTypeDisplay {
  id: string;
  name: string;
  price: number;
  sold: number;
  available: number;
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

/* ─── Zod schema for project form ─── */

const projectSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  productor: z.string().min(1, 'El productor es requerido'),
  imagen_url: z.string().url('URL inválida').or(z.literal('')),
  descripcion: z.string().optional(),
  estado: z.enum(['Borrador', 'Publicado']),
});

type ProjectFormData = z.infer<typeof projectSchema>;

/* ─── Helpers ─── */

const getStatusColor = (status: ProjectDisplay['status']) => {
  switch (status) {
    case 'PUBLISHED': return 'bg-green-500';
    case 'DRAFT': return 'bg-yellow-500';
    case 'ARCHIVED': return 'bg-gray-500';
    case 'FINALIZADO': return 'bg-blue-500';
  }
};

const getOccupancyColor = (percentage: number) => {
  if (percentage < 50) return 'bg-green-500';
  if (percentage <= 80) return 'bg-yellow-500';
  return 'bg-red-500';
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'TBD';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return dateStr || 'TBD';
  }
};

const mapPaymentStatus = (status: string): OrderDisplay['estado'] => {
  if (status === 'paid' || status === 'completed') return 'Completado';
  if (status === 'refunded') return 'Reembolsado';
  return 'Pendiente';
};

const isPastDate = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d < new Date();
  return false;
};

/* ─── Skeleton ─── */

function SkeletonRow() {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-md animate-pulse">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div>
            <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="h-6 bg-gray-200 rounded w-20" />
          <div className="text-right">
            <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Project Modal ─── */

function ProjectModal({
  open,
  onClose,
  onSubmit,
  initialData,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectFormData) => void;
  initialData?: ProjectFormData | null;
  submitting?: boolean;
}) {
  const [form, setForm] = useState<ProjectFormData>({
    nombre: '',
    productor: '',
    imagen_url: '',
    descripcion: '',
    estado: 'Borrador',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm({ nombre: '', productor: '', imagen_url: '', descripcion: '', estado: 'Borrador' });
    }
    setErrors({});
  }, [initialData, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = projectSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(result.data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-base sm:text-lg text-gray-900">
            {initialData ? 'Editar Proyecto' : 'Nuevo Proyecto'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del proyecto</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E63946] ${errors.nombre ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
          </div>

          {/* Productor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Productor</label>
            <input
              type="text"
              value={form.productor}
              onChange={(e) => setForm({ ...form, productor: e.target.value })}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E63946] ${errors.productor ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.productor && <p className="text-xs text-red-500 mt-1">{errors.productor}</p>}
          </div>

          {/* Imagen URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Imagen URL</label>
            <input
              type="text"
              value={form.imagen_url}
              onChange={(e) => setForm({ ...form, imagen_url: e.target.value })}
              placeholder="https://..."
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E63946] ${errors.imagen_url ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.imagen_url && <p className="text-xs text-red-500 mt-1">{errors.imagen_url}</p>}
          </div>

          {/* Descripcion */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E63946]"
            />
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value as 'Borrador' | 'Publicado' })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E63946]"
            >
              <option value="Borrador">Borrador</option>
              <option value="Publicado">Publicado</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#E63946] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#c5303c] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {initialData ? 'Guardar Cambios' : 'Crear Proyecto'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Confirm Dialog ─── */

function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-lg bg-[#E63946] px-4 py-2 text-sm font-medium text-white hover:bg-[#c5303c]">
            Archivar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Actions Dropdown ─── */

function ActionsMenu({
  onEdit,
  onDuplicate,
  onArchive,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-40 rounded-lg bg-white shadow-lg border border-gray-200 py-1">
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Editar
          </button>
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onDuplicate(); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Duplicar
          </button>
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onArchive(); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
            Archivar
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Inline Detail Panel ─── */

function EventDetailPanel({ project }: { project: ProjectDisplay }) {
  const totalRevenue = project.events.reduce((s, e) => s + e.revenue, 0);
  const totalSold = project.events.reduce((s, e) => s + e.ticketsSold, 0);
  const totalCapacity = project.events.reduce((s, e) => s + e.totalTickets, 0);
  const occupancy = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;

  const allZones = project.events.flatMap((e) => e.zones);
  const allSchedules = project.events.flatMap((e) => e.schedules);

  const firstEvent = project.events[0];
  const venue = firstEvent?.venue || '';
  const dateRange = firstEvent?.date || '';

  return (
    <div className="border-t border-gray-200 bg-[#f8f6f6] overflow-hidden transition-all duration-300 ease-in-out animate-fade-in">
      <div className="p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5">
          <div className="lg:w-[40%] flex-shrink-0">
            {project.image_url ? (
              <img
                src={project.image_url}
                alt={project.name}
                className="w-full h-36 sm:h-48 rounded-xl object-cover shadow-md"
              />
            ) : (
              <div className="w-full h-36 sm:h-48 rounded-xl bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-4xl">?</span>
              </div>
            )}
            <h3 className="font-bold text-gray-900 mt-3 text-sm sm:text-base">{project.name}</h3>
            <p className="text-xs sm:text-sm text-gray-500">{venue}</p>
            <p className="text-xs sm:text-sm text-gray-500">{formatDate(dateRange)}</p>
          </div>

          <div className="lg:w-[60%] space-y-3 sm:space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl bg-white border border-gray-200 p-2 sm:p-3 text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Revenue</p>
                <p className="text-sm sm:text-lg font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-2 sm:p-3 text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Vendidos</p>
                <p className="text-sm sm:text-lg font-bold text-gray-900">{totalSold.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-2 sm:p-3 text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Ocupacion</p>
                <p className="text-sm sm:text-lg font-bold text-gray-900">{occupancy.toFixed(1)}%</p>
              </div>
            </div>

            {allZones.length > 0 && (
              <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-[#1E293B]">
                      <tr>
                        <th className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-white">Zona</th>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-white">Cap.</th>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-white">Vend.</th>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-white hidden sm:table-cell">Disp.</th>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-white hidden sm:table-cell">Precio</th>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-white">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allZones.map((z) => {
                        const avail = z.capacidad - z.vendidos;
                        const pct = z.capacidad > 0 ? (z.vendidos / z.capacidad) * 100 : 0;
                        return (
                          <tr key={z.id} className="border-b border-gray-100 last:border-0">
                            <td className="px-2 sm:px-3 py-2 font-medium text-gray-900">{z.nombre}</td>
                            <td className="px-2 sm:px-3 py-2 text-right text-gray-600">{z.capacidad}</td>
                            <td className="px-2 sm:px-3 py-2 text-right text-gray-600">{z.vendidos}</td>
                            <td className="px-2 sm:px-3 py-2 text-right text-gray-600 hidden sm:table-cell">{avail}</td>
                            <td className="px-2 sm:px-3 py-2 text-right text-gray-600 hidden sm:table-cell">{formatCurrency(z.precio)}</td>
                            <td className="px-2 sm:px-3 py-2 text-right">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white ${getOccupancyColor(pct)}`}>
                                {pct.toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {allSchedules.length > 0 && (
              <div className="rounded-xl bg-white border border-gray-200 p-2 sm:p-3">
                <h4 className="font-bold text-gray-900 text-sm mb-2">Funciones</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="pb-2 font-medium">Fecha</th>
                        <th className="pb-2 font-medium">Horario</th>
                        <th className="pb-2 font-medium text-right">Vendidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSchedules.map((s) => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="py-1.5 text-gray-900 font-medium">{s.fecha}</td>
                          <td className="py-1.5 text-gray-600">{s.horaInicio} - {s.horaFin}</td>
                          <td className="py-1.5 text-right font-bold text-[#E63946]">{s.vendidos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

type FilterTab = 'todos' | 'proximos' | 'pasados';

export default function EventsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectDisplay[]>([]);
  const [events, setEvents] = useState<DulosEvent[]>([]);
  const [venueMap, setVenueMap] = useState<Map<string, Venue>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('todos');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectFormData | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Confirm dialog
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [projectsTab, events, zones, orders, schedules, venues] = await Promise.all([
        fetchProyectos().catch(() => ({ headers: [], rows: [], totalRows: 0 })),
        fetchAllEvents().catch(() => []),
        fetchZones().catch(() => []),
        fetchAllOrders().catch(() => []),
        fetchSchedules().catch(() => []),
        getVenueMap().catch(() => new Map<string, Venue>()),
      ]);

      setVenueMap(venues);
      setEvents(events);

      // Helper functions to parse concatenated strings from dashboard_tabs
      const parseProject = (proyectoField: string) => {
        const idMatch = proyectoField.match(/(.+?)ID:\s*(.+)$/);
        if (idMatch) {
          return { name: idMatch[1].trim(), id: idMatch[2].trim() };
        }
        return { name: proyectoField, id: proyectoField };
      };

      const parseProducer = (producerField: string) => {
        // If it looks like money (starts with $), return a default producer
        if (producerField.startsWith('$')) {
          return 'Dulos Entertainment';
        }
        return producerField;
      };

      const parseMoney = (moneyField: string): number => {
        if (!moneyField) return 0;
        const cleaned = moneyField.replace(/[$,+]/g, '');
        return parseFloat(cleaned) || 0;
      };

      const parseStatus = (statusField: string): ProjectDisplay['status'] => {
        if (statusField.includes('PUBLISHED')) return 'PUBLISHED';
        if (statusField.includes('DRAFT')) return 'DRAFT';
        if (statusField.includes('ARCHIVED')) return 'ARCHIVED';
        return 'DRAFT';
      };

      // Process projects from dashboard_tabs
      const projectsData: ProjectDisplay[] = projectsTab.rows.map((row) => {
        const [proyecto, productor, estado, eventos, ingresos, comision] = row;

        const parsedProject = parseProject(proyecto || '');
        const projectEvents = events.filter(event =>
          event.name.includes(parsedProject.name) || event.id === parsedProject.id
        );

        const eventsDisplay: EventDisplay[] = projectEvents.map((event) => {
          const eventZones = zones.filter((z) => z.event_id === event.id);
          const eventOrders = orders.filter((o) => o.event_id === event.id);
          const eventSchedules = schedules.filter((s) => s.event_id === event.id);

          const ticketsSold = eventZones.reduce((sum, z) => sum + z.sold, 0);
          const totalTickets = eventZones.reduce((sum, z) => sum + z.available + z.sold, 0);
          const revenue = eventZones.reduce((sum, z) => sum + (z.sold * z.price), 0);

          const ticketTypeMap = new Map<string, { price: number; sold: number; available: number }>();
          eventZones.forEach((z) => {
            const existing = ticketTypeMap.get(z.zone_name);
            if (existing) {
              existing.sold += z.sold;
              existing.available += z.available;
              existing.price = Math.max(existing.price, z.price);
            } else {
              ticketTypeMap.set(z.zone_name, { price: z.price, sold: z.sold, available: z.available });
            }
          });

          return {
            id: event.id,
            name: event.name,
            venue: getVenueName(event.venue_id, venues) + (getVenueCity(event.venue_id, venues) ? `, ${getVenueCity(event.venue_id, venues)}` : ''),
            date: event.start_date ? formatDate(event.start_date) : 'TBD',
            image_url: event.image_url || '',
            ticketsSold,
            totalTickets,
            revenue,
            zones: eventZones.map((z, idx) => ({
              id: `zone-${event.id}-${idx}`,
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
            ticketTypes: Array.from(ticketTypeMap.entries())
              .map(([tName, data], idx) => ({
                id: `ticket-type-${idx}`,
                name: tName,
                price: data.price,
                sold: data.sold,
                available: data.available,
              }))
              .sort((a, b) => b.price - a.price),
          };
        });

        const allPast = projectEvents.every((e) => isPastDate(e.start_date));
        const parsedRevenue = parseMoney(ingresos || '');
        const parsedCommission = parseMoney(comision || '');

        // Determine status from events or state
        let finalStatus: ProjectDisplay['status'] = parseStatus(estado || '');
        if (allPast) {
          finalStatus = 'FINALIZADO';
        } else if (projectEvents.some((e) => e.status === 'active')) {
          finalStatus = 'PUBLISHED';
        }

        return {
          id: parsedProject.id,
          name: parsedProject.name,
          producer: parseProducer(productor || ''),
          image_url: eventsDisplay[0]?.image_url || '',
          status: finalStatus,
          events: eventsDisplay,
          isPast: allPast,
          revenue: parsedRevenue,
          commission: parsedCommission,
          eventCount: parseInt(eventos || '0') || eventsDisplay.length,
        };
      });

      setProjects(projectsData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading events:', error);
      setLoading(false);
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const filteredProjects = projects
    .filter((p) => {
      if (filterTab === 'proximos') {
        return p.events.some(event => {
          const eventInProjects = events.find(e => e.id === event.id);
          return eventInProjects?.start_date && new Date(eventInProjects.start_date) > new Date();
        });
      }
      if (filterTab === 'pasados') {
        return p.events.every(event => {
          const eventInProjects = events.find(e => e.id === event.id);
          return eventInProjects?.start_date && new Date(eventInProjects.start_date) < new Date();
        });
      }
      return true;
    })
    .filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.producer.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const getProjectTotals = (project: ProjectDisplay) => {
    // Use parsed revenue from dashboard_tabs if available, otherwise calculate from events
    const totalRevenue = project.revenue || project.events.reduce((sum, e) => sum + e.revenue, 0);
    const eventCount = project.eventCount || project.events.length;
    const totalSold = project.events.reduce((s, e) => s + e.ticketsSold, 0);
    const totalCap = project.events.reduce((s, e) => s + e.totalTickets, 0);
    const occupancy = totalCap > 0 ? (totalSold / totalCap) * 100 : 0;
    return { totalRevenue, eventCount, occupancy, commission: project.commission };
  };

  const handleCreateSubmit = async (data: ProjectFormData) => {
    setSubmitting(true);
    try {
      const result = await createEvent({
        name: data.nombre,
        producer: data.productor,
        image_url: data.imagen_url,
        description: data.descripcion,
        status: data.estado === 'Publicado' ? 'active' : 'draft',
      });
      if (result.success) {
        toast.success('Evento creado exitosamente');
        setModalOpen(false);
        setEditingProject(null);
        setEditingProjectId(null);
        loadData();
      } else {
        toast.error(result.error || 'Error al crear el evento');
      }
    } catch {
      toast.error('Error al crear el evento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (data: ProjectFormData) => {
    if (!editingProjectId) return;
    setSubmitting(true);
    try {
      const project = projects.find(p => p.id === editingProjectId);
      const eventId = project?.events[0]?.id;
      if (eventId) {
        const result = await updateEvent(eventId, {
          name: data.nombre,
          producer: data.productor,
          image_url: data.imagen_url,
          description: data.descripcion,
          status: data.estado === 'Publicado' ? 'active' : 'draft',
        });
        if (result.success) {
          toast.success('Proyecto actualizado exitosamente');
          setModalOpen(false);
          setEditingProject(null);
          setEditingProjectId(null);
          loadData();
        } else {
          toast.error(result.error || 'Error al actualizar');
        }
      } else {
        toast.error('No se encontró el evento');
      }
    } catch {
      toast.error('Error al actualizar el proyecto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (project: ProjectDisplay) => {
    setEditingProject({
      nombre: project.name,
      productor: project.producer,
      imagen_url: project.image_url,
      descripcion: '',
      estado: project.status === 'PUBLISHED' ? 'Publicado' : 'Borrador',
    });
    setEditingProjectId(project.id);
    setModalOpen(true);
  };

  const handleDuplicate = (project: ProjectDisplay) => {
    setEditingProject({
      nombre: `${project.name} (copia)`,
      productor: project.producer,
      imagen_url: project.image_url,
      descripcion: '',
      estado: 'Borrador',
    });
    setEditingProjectId(null);
    setModalOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (archiveTarget) {
      const project = projects.find(p => p.id === archiveTarget);
      const eventId = project?.events[0]?.id;
      if (eventId) {
        const result = await archiveEvent(eventId);
        if (result.success) {
          toast.success('Proyecto archivado');
          setProjects((prev) =>
            prev.map((p) =>
              p.id === archiveTarget ? { ...p, status: 'FINALIZADO' as const, isPast: true } : p
            )
          );
        } else {
          toast.error(result.error || 'Error al archivar');
        }
      } else {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === archiveTarget ? { ...p, status: 'FINALIZADO' as const, isPast: true } : p
          )
        );
        toast.success('Proyecto archivado');
      }
    }
    setArchiveTarget(null);
  };

  const emptyLabel = filterTab === 'proximos' ? 'proximos' : filterTab === 'pasados' ? 'pasados' : '';

  /* ─── Render ─── */

  if (loading) {
    return (
      <div className="bg-[#f8f6f6] py-4">
        <div className="mx-auto max-w-[1200px] px-3 sm:px-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">EVENTOS</h1>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f6f6] py-4">
      <div className="mx-auto max-w-[1200px] px-3 sm:px-4">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">EVENTOS</h1>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              type="text"
              placeholder="Buscar proyectos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 sm:px-4 py-2 text-sm focus:border-[#E63946] focus:outline-none focus:ring-1 focus:ring-[#E63946]"
            />
            <button
              onClick={() => { setEditingProject(null); setEditingProjectId(null); setModalOpen(true); }}
              className="rounded-lg bg-[#E63946] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#c5303c]"
            >
              + Nuevo Proyecto
            </button>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
          {([
            { key: 'todos' as FilterTab, label: 'Todos' },
            { key: 'proximos' as FilterTab, label: 'Proximos' },
            { key: 'pasados' as FilterTab, label: 'Pasados' },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilterTab(opt.key)}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors rounded-lg ${
                filterTab === opt.key
                  ? 'bg-[#1E293B] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Project Cards */}
        <div className="space-y-2">
          {filteredProjects.map((project) => {
            const isExpanded = expandedId === project.id;
            const { totalRevenue, eventCount, occupancy, commission } = getProjectTotals(project);

            return (
              <div key={project.id} className="overflow-hidden rounded-lg bg-white shadow-md">
                <div
                  onClick={() => toggleExpand(project.id)}
                  className="flex cursor-pointer items-center justify-between px-2 sm:px-3 py-2 sm:py-2.5 transition-colors hover:bg-[#f8f6f6]"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <svg
                      className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {project.image_url ? (
                      <img src={project.image_url} alt="" className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-400 text-xs sm:text-sm">?</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{project.name}</h3>
                      <p className="text-[10px] sm:text-xs text-gray-500 truncate">{project.producer}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium text-white ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                    {project.isPast && (
                      <span className="text-[10px] sm:text-xs text-gray-500 hidden sm:inline">{occupancy.toFixed(0)}% ocup.</span>
                    )}
                    <div className="text-right hidden sm:block">
                      <p className="font-semibold text-gray-900 text-xs sm:text-sm">{formatCurrency(totalRevenue)}</p>
                      {commission > 0 && (
                        <p className="text-[10px] sm:text-xs text-green-600">+{formatCurrency(commission)}</p>
                      )}
                      <p className="text-[10px] sm:text-xs text-gray-500">{eventCount} evento{eventCount !== 1 ? 's' : ''}</p>
                    </div>
                    <ActionsMenu
                      onEdit={() => handleEdit(project)}
                      onDuplicate={() => handleDuplicate(project)}
                      onArchive={() => setArchiveTarget(project.id)}
                    />
                  </div>
                </div>

                {isExpanded && <EventDetailPanel project={project} />}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredProjects.length === 0 && !loading && (
          <div className="rounded-lg bg-white p-8 sm:p-12 text-center shadow-md">
            <p className="text-gray-500 mb-2">
              No hay eventos {emptyLabel}
            </p>
            <button
              onClick={() => { setEditingProject(null); setEditingProjectId(null); setModalOpen(true); }}
              className="text-sm text-[#E63946] font-medium hover:underline"
            >
              Crea tu primer evento
            </button>
          </div>
        )}

        {/* Modals */}
        <ProjectModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditingProject(null); setEditingProjectId(null); }}
          onSubmit={editingProjectId ? handleEditSubmit : handleCreateSubmit}
          initialData={editingProject}
          submitting={submitting}
        />

        <ConfirmDialog
          open={archiveTarget !== null}
          title="Archivar Proyecto"
          message="Este proyecto se movera a la seccion de pasados. Puedes reactivarlo despues."
          onConfirm={handleArchiveConfirm}
          onCancel={() => setArchiveTarget(null)}
        />
      </div>
    </div>
  );
}
