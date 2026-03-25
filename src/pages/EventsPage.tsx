'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  fetchAllEvents,
  fetchZones,
  fetchAllOrders,
  fetchSchedules,
  fetchEventDashboard,
  fetchScheduleInventory,
  fetchVenueSeats,
  fetchEventSectionSeatsForEvent,
  fetchEventSections,
  fetchVenues,
  getVenueMap,
  getVenueName,
  getVenueCity,
  DulosEvent,
  TicketZone,
  Order,
  Schedule,
  ScheduleInventory,
  VenueSeat,
  EventSection,
  EventSectionSeat,
  Venue,
  EventDashboard,
} from '../lib/supabase';
import { createEvent, updateEvent, archiveEvent } from '../app/actions/events.actions';

/* ─── Types ─── */

interface ProjectDisplay {
  id: string;
  name: string;
  producer: string;
  image_url: string;
  status: 'active' | 'draft' | 'sold_out' | 'cancelled' | 'completed';
  events: EventDisplay[];
  isPast: boolean;
  revenue: number;
  commission: number;
  eventCount: number;
  event_type?: string;
}

interface EventDisplay {
  id: string;
  name: string;
  venue: string;
  venueId: string;
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
  tipo?: string; // ga | numbered | hybrid
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

// Dimension 1: event_type (single/recurring/multiday)
const getEventTypeBadge = (eventType?: string) => {
  switch (eventType) {
    case 'recurring': return <span className="badge badge-recurring">Recurrente</span>;
    case 'multiday': return <span className="badge badge-multiday">Multiday</span>;
    case 'single': return <span className="badge badge-single">Único</span>;
    default: return <span className="badge badge-single">Único</span>;
  }
};

// Dimension 2: zone_type (ga/reserved/hybrid) — per zone
const getZoneTypeBadge = (zoneType?: string) => {
  switch (zoneType) {
    case 'reserved': case 'numbered': return <span className="badge badge-reserved">Numerado</span>;
    case 'hybrid': return <span className="badge badge-hybrid">Mixto</span>;
    case 'ga': default: return <span className="badge badge-ga">GA</span>;
  }
};

const getStatusColor = (status: ProjectDisplay['status']) => {
  switch (status) {
    case 'active': return 'bg-green-500';
    case 'draft': return 'bg-yellow-500';
    case 'sold_out': return 'bg-[#EF4444]';
    case 'cancelled': return 'bg-gray-500';
    case 'completed': return 'bg-blue-500';
    default: return 'bg-gray-400';
  }
};

const getStatusLabel = (status: ProjectDisplay['status']): string => {
  switch (status) {
    case 'active': return 'Activo';
    case 'draft': return 'Borrador';
    case 'sold_out': return 'Agotado';
    case 'cancelled': return 'Cancelado';
    case 'completed': return 'Finalizado';
    default: return status;
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
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'TBD';
    return d.toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return 'TBD';
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

/* ─── SVG Cache — prevents flickering from cache-control: no-cache ─── */
const svgBlobCache = new Map<string, string>();

function CachedSvgImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(svgBlobCache.get(src) || null);
  const [loading, setLoading] = useState(!svgBlobCache.has(src));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (svgBlobCache.has(src)) {
      setBlobUrl(svgBlobCache.get(src)!);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(src)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        svgBlobCache.set(src, url);
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError(true); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [src]);

  if (error) return null;
  if (loading) return (
    <div className={`${className || ''} flex items-center justify-center bg-gray-50 rounded animate-pulse`} style={{ minHeight: '120px' }}>
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-[#EF4444] rounded-full animate-spin mx-auto mb-1" />
        <p className="text-[10px] text-gray-400">Cargando mapa...</p>
      </div>
    </div>
  );
  return <img src={blobUrl!} alt={alt} className={className} />;
}

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

/* ─── Project Modal (Paolo's Modular Design) ─── */
/* Step 1: Select Venue → Step 2: Event Details + Type → Step 3: Zones → Create */

function ProjectModal({
  open,
  onClose,
  onSubmit,
  initialData,
  submitting,
  venues,
  existingProducers = [],
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectFormData) => void;
  initialData?: ProjectFormData | null;
  submitting?: boolean;
  venues?: Venue[];
  existingProducers?: string[];
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ProjectFormData>({
    nombre: '',
    productor: '',
    imagen_url: '',
    descripcion: '',
    estado: 'Borrador',
  });
  const [venueId, setVenueId] = useState('');
  const [eventType, setEventType] = useState<'single' | 'recurring' | 'multiday'>('single');
  const [zones, setZones] = useState<{ name: string; type: 'ga' | 'reserved'; price: number; capacity: number }[]>([
    { name: '', type: 'ga', price: 0, capacity: 0 }
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedVenue = (venues || []).find(v => v.id === venueId);

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
      setStep(2); // Skip venue selection when editing
    } else {
      setForm({ nombre: '', productor: '', imagen_url: '', descripcion: '', estado: 'Borrador' });
      setStep(1);
      setVenueId('');
      setEventType('single');
      setZones([{ name: '', type: 'ga', price: 0, capacity: 0 }]);
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

  const addZone = () => setZones([...zones, { name: '', type: 'ga', price: 0, capacity: 0 }]);
  const removeZone = (i: number) => zones.length > 1 && setZones(zones.filter((_, idx) => idx !== i));
  const updateZone = (i: number, field: string, val: string | number) => {
    const updated = [...zones];
    (updated[i] as any)[field] = val;
    setZones(updated);
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#EF4444]";
  const errCls = "w-full rounded-lg border border-red-400 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#EF4444]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header with steps */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-gray-900">
              {initialData ? 'Editar Evento' : 'Nuevo Evento'}
            </h3>
            {!initialData && (
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3].map(s => (
                  <span key={s} className={`w-6 h-1 rounded-full ${s <= step ? 'bg-[#EF4444]' : 'bg-gray-200'}`} />
                ))}
                <span className="text-[10px] text-gray-400 ml-2">
                  {step === 1 ? 'Recinto' : step === 2 ? 'Evento' : 'Zonas'}
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* STEP 1: Venue Selection */}
        {step === 1 && !initialData && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">El evento hereda dirección, timezone y mapa del recinto.</p>
            <select
              value={venueId}
              onChange={e => setVenueId(e.target.value)}
              className={inputCls}
            >
              <option value="">Seleccionar recinto...</option>
              {(venues || []).map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} — {v.city}, {v.state} · Cap. {v.capacity?.toLocaleString()}
                </option>
              ))}
            </select>
            {selectedVenue && (
              <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 text-xs space-y-1">
                <p className="font-bold">{selectedVenue.name}</p>
                <p className="text-gray-500">{[selectedVenue.city, selectedVenue.state, selectedVenue.country].filter(Boolean).join(', ')}</p>
                <p className="text-gray-500">Capacidad: {selectedVenue.capacity?.toLocaleString()} · {selectedVenue.timezone === 'America/Mexico_City' ? 'CDMX' : selectedVenue.timezone?.replace('America/', '') || ''}</p>
                {selectedVenue.has_seatmap && <span className="badge badge-reserved">Asientos Numerados</span>}
                {selectedVenue.layout_svg_url && (
                  <CachedSvgImage src={selectedVenue.layout_svg_url} alt="Mapa" className="w-full max-h-32 object-contain rounded mt-2" />
                )}
              </div>
            )}
            <button
              type="button"
              disabled={!venueId}
              onClick={() => setStep(2)}
              className="w-full rounded-lg bg-[#EF4444] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#c5303c] disabled:opacity-30"
            >
              Siguiente →
            </button>
          </div>
        )}

        {/* STEP 2: Event Details */}
        {step === 2 && (
          <form onSubmit={initialData ? handleSubmit : (e) => { e.preventDefault(); setStep(3); }} className="space-y-3">
            {selectedVenue && !initialData && (
              <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1">
                <span>📍 {selectedVenue.name}</span>
                <button type="button" onClick={() => setStep(1)} className="text-blue-500 hover:underline">cambiar</button>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del evento</label>
              <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={errors.nombre ? errCls : inputCls} />
              {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
            </div>
            {!initialData && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de evento</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'single' as const, label: 'Único', desc: 'Una función' },
                    { key: 'recurring' as const, label: 'Recurrente', desc: 'Múltiples funciones' },
                    { key: 'multiday' as const, label: 'Multiday', desc: 'Festival / varios días' },
                  ]).map(t => (
                    <button
                      key={t.key} type="button"
                      onClick={() => setEventType(t.key)}
                      className={`rounded-lg border p-2 text-center transition-colors ${eventType === t.key ? 'border-[#EF4444] bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <p className="text-xs font-bold">{t.label}</p>
                      <p className="text-[9px] text-gray-400">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Productor</label>
              <input type="text" list="producer-options" value={form.productor} onChange={e => setForm({ ...form, productor: e.target.value })} className={errors.productor ? errCls : inputCls} placeholder="Selecciona o escribe un productor..." />
              <datalist id="producer-options">
                {existingProducers.map(p => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagen URL</label>
              <input type="text" value={form.imagen_url} onChange={e => setForm({ ...form, imagen_url: e.target.value })} placeholder="https://supabase.co/storage/v1/object/public/..." className={inputCls} />
              {form.imagen_url && (
                <img src={form.imagen_url} alt="Preview" className="mt-2 w-full max-h-32 object-cover rounded-lg border border-gray-200" onError={e => (e.currentTarget.style.display = 'none')} />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} placeholder="Descripción del evento para los asistentes..." className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as 'Borrador' | 'Publicado' })} className={inputCls}>
                <option value="Borrador">Borrador</option>
                <option value="Publicado">Publicado</option>
              </select>
            </div>
            <div className="flex gap-2">
              {!initialData && <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">← Atrás</button>}
              <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-[#EF4444] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#c5303c] disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                {initialData ? 'Guardar Cambios' : 'Siguiente → Zonas'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Zones Configuration */}
        {step === 3 && !initialData && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span>📍 {selectedVenue?.name}</span>
              <span>·</span>
              <span>{eventType === 'single' ? 'Único' : eventType === 'recurring' ? 'Recurrente' : 'Multiday'}</span>
            </div>
            <p className="text-xs text-gray-500">Define las zonas de venta. Cada zona tiene su tipo, precio y capacidad.</p>
            {zones.map((z, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2 relative">
                {zones.length > 1 && (
                  <button type="button" onClick={() => removeZone(i)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 text-sm">&times;</button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Nombre</label>
                    <input type="text" value={z.name} onChange={e => updateZone(i, 'name', e.target.value)} placeholder="Ej: VIP, General, Platea..." className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Tipo de asiento</label>
                    <select value={z.type} onChange={e => updateZone(i, 'type', e.target.value)} className={inputCls}>
                      <option value="ga">General (GA)</option>
                      <option value="reserved">Numerado</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Precio (MXN)</label>
                    <input type="number" value={z.price || ''} onChange={e => updateZone(i, 'price', Number(e.target.value))} placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Capacidad</label>
                    <input type="number" value={z.capacity || ''} onChange={e => updateZone(i, 'capacity', Number(e.target.value))} placeholder="0" className={inputCls} />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addZone} className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-400 hover:border-[#EF4444] hover:text-[#EF4444]">
              + Agregar zona
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">← Atrás</button>
              <button
                type="button"
                disabled={submitting || !form.nombre || zones.some(z => !z.name)}
                onClick={() => {
                  const result = projectSchema.safeParse(form);
                  if (!result.success) { setStep(2); return; }
                  onSubmit(result.data);
                }}
                className="flex-1 rounded-lg bg-[#EF4444] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#c5303c] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                Crear Evento
              </button>
            </div>
          </div>
        )}
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
          <button onClick={onConfirm} className="flex-1 rounded-lg bg-[#EF4444] px-4 py-2 text-sm font-medium text-white hover:bg-[#c5303c]">
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

function EventDetailPanel({ project, dashboardData, venueMap }: { project: ProjectDisplay; dashboardData: EventDashboard[]; venueMap: Map<string, Venue> }) {
  const eventId = project.events[0]?.id;
  const venueId = project.events[0]?.venueId;
  const venueData = venueId ? venueMap.get(venueId) : undefined;
  const eventDashZones = dashboardData.filter(d => d.event_id === eventId);
  const [schedInv, setSchedInv] = useState<ScheduleInventory[]>([]);
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);
  const [venueSeats, setVenueSeats] = useState<VenueSeat[]>([]);
  const [sectionSeats, setSectionSeats] = useState<(EventSectionSeat & { section_name?: string })[]>([]);
  const [eventSections, setEventSections] = useState<EventSection[]>([]);
  // Auto-show seat map for reserved events (zone_type, not event_type)
  const hasReservedZones = project.events.flatMap(e => e.zones).some(z => z.tipo === 'reserved' || z.tipo === 'numbered');
  const [showSeatMap, setShowSeatMap] = useState(hasReservedZones);

  // Check zone types (Dimension 2) — NOT event_type which is Dimension 1
  const hasReservedOrHybridZones = project.events.flatMap(e => e.zones).some(
    z => z.tipo === 'reserved' || z.tipo === 'numbered' || z.tipo === 'hybrid'
  );

  // Fetch schedule inventory + seat data on mount
  useEffect(() => {
    if (!eventId) return;
    const scheduleIds = project.events.flatMap(e => e.schedules.map(s => s.id));
    Promise.all(scheduleIds.map(sid => fetchScheduleInventory(sid)))
      .then(results => setSchedInv(results.flat()))
      .catch(() => {});

    // Always try to fetch seat data — venue may have seats even if zones say 'ga' (Libanés bug)
    const venueId = project.events[0]?.venueId;
    if (venueId) {
      fetchVenueSeats(venueId).then(setVenueSeats).catch(() => {});
    }
    fetchEventSectionSeatsForEvent(eventId).then(setSectionSeats).catch(() => {});
    fetchEventSections(eventId).then(setEventSections).catch(() => {});
  }, [eventId]);

  const totalRevenue = project.events.reduce((s, e) => s + e.revenue, 0);
  const totalSold = project.events.reduce((s, e) => s + e.ticketsSold, 0);
  const totalCapacity = project.events.reduce((s, e) => s + e.totalTickets, 0);
  const occupancy = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;

  // Use ticket_zones data (projectZones) as primary — v_event_dashboard often has zeros
  const projectZones = project.events.flatMap((e) => e.zones);
  // Check if dashboard data actually has useful values (not all zeros)
  const dashHasData = eventDashZones.some(d => (d.zone_price || 0) > 0 || (d.zone_sold || 0) > 0 || (d.zone_available || 0) > 0);
  const allZones: ZoneDisplay[] = dashHasData
    ? eventDashZones.map((d, idx) => ({
        id: `dash-${eventId}-${idx}`,
        nombre: d.zone_name,
        tipo: projectZones.find(pz => pz.nombre === d.zone_name)?.tipo,
        precio: d.zone_price || 0,
        capacidad: (d.zone_sold || 0) + (d.zone_available || 0),
        vendidos: d.zone_sold || 0,
      }))
    : projectZones;
  const allSchedules = project.events.flatMap((e) => e.schedules).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

  const firstEvent = project.events[0];
  const venue = firstEvent?.venue || '';
  const dateRange = firstEvent?.date || '';

  return (
    <div className="border-t border-gray-200 bg-[#f8f6f6] overflow-hidden transition-all duration-300 ease-in-out animate-fade-in section-card">
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
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {getEventTypeBadge(project.event_type)}
              {allZones.length > 0 && (() => {
                const types = [...new Set(allZones.map(z => z.tipo).filter(Boolean))];
                return types.map((t, i) => <span key={i}>{getZoneTypeBadge(t)}</span>);
              })()}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">{venue}</p>
            {dateRange && formatDate(dateRange) !== 'TBD' && (
              <p className="text-xs sm:text-sm text-gray-500">{formatDate(dateRange)}</p>
            )}
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

            {/* For RECURRING events: show schedules FIRST (buyer picks date) */}
            {project.event_type === 'recurring' && allSchedules.length > 0 && (() => {
              const MAX_VISIBLE = 6;
              const hasMany = allSchedules.length > MAX_VISIBLE;
              const [showAllSchedules, setShowAllSchedules] = React.useState(false);
              const visibleSchedules = (hasMany && !showAllSchedules) ? allSchedules.slice(0, MAX_VISIBLE) : allSchedules;
              const totalSchedSoldAll = allSchedules.reduce((sum, s) => {
                const inv = schedInv.filter(si => si.schedule_id === s.id);
                return sum + inv.reduce((iSum, si) => iSum + (si.sold || 0), 0) + (s.vendidos || 0);
              }, 0);
              const totalSchedCap = allSchedules.length * (allZones.reduce((sum, z) => sum + (z.capacidad || 0), 0) || 100);
              return (
              <div className="section-card ring-1 ring-indigo-200">
                <div className="section-card-header">
                  <h4 className="section-card-title">
                    📅 Funciones ({allSchedules.length})
                    <span className="ml-2 text-[10px] text-indigo-500 font-normal">El comprador elige fecha primero</span>
                  </h4>
                  {allSchedules.length > 1 && (
                    <span className="ml-auto text-[10px] text-gray-400">{totalSchedSoldAll}/{totalSchedCap} vendidos total</span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table text-xs">
                    <thead><tr><th>Fecha</th><th>Horario</th><th className="text-right">Vendidos</th></tr></thead>
                    <tbody>
                      {visibleSchedules.map((s) => {
                        const inv = schedInv.filter(si => si.schedule_id === s.id);
                        const totalSchedSold = inv.reduce((sum, si) => sum + (si.sold || 0), 0);
                        return (
                          <tr key={s.id} className={inv.length > 0 ? 'cursor-pointer' : ''} onClick={() => inv.length > 0 && setExpandedSchedule(expandedSchedule === s.id ? null : s.id)}>
                            <td className="font-bold">{formatDate(s.fecha)}</td>
                            <td className="text-gray-600">{s.horaInicio}{s.horaFin ? ` — ${s.horaFin}` : ''}</td>
                            <td className="text-right font-bold text-[#EF4444]">{totalSchedSold || s.vendidos}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {hasMany && (
                    <button
                      onClick={() => setShowAllSchedules(!showAllSchedules)}
                      className="w-full py-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium border-t border-gray-100"
                    >
                      {showAllSchedules ? `▲ Mostrar solo ${MAX_VISIBLE}` : `▼ Ver las ${allSchedules.length} funciones`}
                    </button>
                  )}
                </div>
              </div>
              );
            })()}

            {allZones.length > 0 && (() => {
              // Only show Tipo column when zones have MIXED types
              const uniqueTypes = [...new Set(allZones.map(z => z.tipo).filter(Boolean))];
              const showTipoCol = uniqueTypes.length > 1;
              return (
              <div className="section-card">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Zona</th>
                        {showTipoCol && <th className="hidden sm:table-cell">Tipo</th>}
                        <th className="text-right">Cap.</th>
                        <th className="text-right">Vend.</th>
                        <th className="text-right hidden sm:table-cell">Disp.</th>
                        <th className="text-right hidden sm:table-cell">Precio</th>
                        <th className="text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allZones.map((z, zIdx) => {
                        const cap = z.capacidad || 0;
                        const vend = z.vendidos || 0;
                        const avail = cap - vend;
                        const dashZone = eventDashZones[zIdx];
                        const pct = dashZone ? (dashZone.percent_sold || 0) : (cap > 0 ? (vend / cap) * 100 : 0);
                        return (
                          <tr key={z.id}>
                            <td className="font-medium">{z.nombre}</td>
                            {showTipoCol && <td className="hidden sm:table-cell">{getZoneTypeBadge(z.tipo)}</td>}
                            <td className="text-right">{cap.toLocaleString()}</td>
                            <td className="text-right">{vend.toLocaleString()}</td>
                            <td className="text-right hidden sm:table-cell">{avail.toLocaleString()}</td>
                            <td className="text-right hidden sm:table-cell">{formatCurrency(z.precio || 0)}</td>
                            <td className="text-right">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white ${getOccupancyColor(pct)}`}>
                                {pct.toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {allZones.length > 1 && (() => {
                        const totalCap = allZones.reduce((s, z) => s + z.capacidad, 0);
                        const totalVend = allZones.reduce((s, z) => s + z.vendidos, 0);
                        const totalAvail = totalCap - totalVend;
                        const totalPct = totalCap > 0 ? (totalVend / totalCap) * 100 : 0;
                        return (
                          <tr className="total-row">
                            <td className="font-bold">Total</td>
                            {showTipoCol && <td className="hidden sm:table-cell"></td>}
                            <td className="text-right">{totalCap}</td>
                            <td className="text-right">{totalVend}</td>
                            <td className="text-right hidden sm:table-cell">{totalAvail}</td>
                            <td className="text-right hidden sm:table-cell">—</td>
                            <td className="text-right">{totalPct.toFixed(0)}%</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}

            {/* Schedules for single/multiday (recurring already shown above zones) */}
            {allSchedules.length > 0 && project.event_type !== 'recurring' && (
              <div className="section-card">
                <div className="section-card-header">
                  <h4 className="section-card-title">Funciones ({allSchedules.length})</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Horario</th>
                        <th className="text-right">Vendidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSchedules.map((s) => {
                        const inv = schedInv.filter(si => si.schedule_id === s.id);
                        const isSchedExp = expandedSchedule === s.id;
                        return (
                          <React.Fragment key={s.id}>
                            <tr
                              className={inv.length > 0 ? 'cursor-pointer' : ''}
                              onClick={() => inv.length > 0 && setExpandedSchedule(isSchedExp ? null : s.id)}
                            >
                              <td className="font-medium">
                                {inv.length > 0 && <span className="text-gray-400 mr-1 text-[10px]">{isSchedExp ? '▼' : '▶'}</span>}
                                {s.fecha}
                              </td>
                              <td>{s.horaInicio} - {s.horaFin}</td>
                              <td className="text-right font-bold text-[#EF4444]">{s.vendidos}</td>
                            </tr>
                            {isSchedExp && inv.length > 0 && (
                              <tr>
                                <td colSpan={3} className="bg-gray-50 p-2">
                                  <div className="flex flex-wrap gap-1.5">
                                    {inv.map((si, idx) => {
                                      const zoneName = allZones.find(z => z.id.includes(si.zone_id))?.nombre || `Zona ${idx + 1}`;
                                      const pct = si.total_capacity > 0 ? (si.sold / si.total_capacity) * 100 : 0;
                                      return (
                                        <span key={si.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-white ${pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-green-500'}`}>
                                          {zoneName}: {si.sold}/{si.total_capacity} ({pct.toFixed(0)}%)
                                          {si.reserved > 0 && <span className="opacity-70">+{si.reserved}res</span>}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* Seat Map for reserved/hybrid events */}
            {/* Event Sections (Paolo's colored sections with price/capacity) */}
            {eventSections.filter(s => s.section !== 'default').length > 0 && (
              <div className="section-card">
                <div className="section-card-header">
                  <h4 className="section-card-title">Secciones del Evento ({eventSections.filter(s => s.section !== 'default').length})</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table text-xs">
                    <thead><tr><th>Sección</th><th className="text-right">Precio</th><th className="text-right">Capacidad</th><th className="text-center">Color</th></tr></thead>
                    <tbody>
                      {eventSections.filter(s => s.section !== 'default').map(s => (
                        <tr key={s.id}>
                          <td className="font-bold">
                            {s.color && <span className="inline-block w-3 h-3 rounded-full mr-1.5 align-middle" style={{ backgroundColor: s.color }}></span>}
                            {s.section}
                          </td>
                          <td className="text-right">{formatCurrency(s.price || 0)}</td>
                          <td className="text-right">{s.capacity?.toLocaleString() || '—'}</td>
                          <td className="text-center">
                            {s.color ? (
                              <span className="text-[10px] font-mono text-gray-400">{s.color}</span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* Venue Layout Map — SVG preferred, fallback to image_url */}
            {(venueData?.layout_svg_url || venueData?.image_url) && (
              <div className="section-card">
                <div className="section-card-header">
                  <span className="section-card-title">🏟️ Mapa del Recinto</span>
                  <span className="ml-auto text-xs text-gray-400">{venueData.name}</span>
                </div>
                <div className="section-card-body flex justify-center">
                  {venueData.layout_svg_url ? (
                    <CachedSvgImage
                      src={venueData.layout_svg_url}
                      alt={`Mapa ${venueData.name}`}
                      className="max-w-full max-h-64 object-contain rounded"
                    />
                  ) : venueData.image_url ? (
                    <img
                      src={venueData.image_url}
                      alt={`Mapa ${venueData.name}`}
                      className="max-w-full max-h-64 object-contain rounded"
                    />
                  ) : null}
                </div>
              </div>
            )}
            {/* Seat Map for venues with actual seats loaded */}
            {venueSeats.length > 0 && (
              <div className="section-card">
                <div
                  className="section-card-header cursor-pointer"
                  onClick={() => setShowSeatMap(!showSeatMap)}
                >
                  <h4 className="section-card-title">
                    <span className="text-gray-400 mr-1 text-[10px]">{showSeatMap ? '▼' : '▶'}</span>
                    Mapa de Asientos
                  </h4>
                  <span className="ml-auto text-xs text-gray-400">{venueSeats.length} asientos</span>
                </div>
                {showSeatMap && (() => {
                  // Build seat status map from event_section_seats
                  const seatStatusMap = new Map<string, string>();
                  sectionSeats.forEach(ss => {
                    if (ss.venue_seat_id) seatStatusMap.set(ss.venue_seat_id, ss.status || 'available');
                  });

                  // Group by section
                  const sectionMap = new Map<string, VenueSeat[]>();
                  venueSeats.forEach(s => {
                    const sec = s.section || 'General';
                    if (!sectionMap.has(sec)) sectionMap.set(sec, []);
                    sectionMap.get(sec)!.push(s);
                  });

                  const statusColor = (status: string) =>
                    status === 'sold' ? 'bg-[#EF4444]' :
                    status === 'reserved' ? 'bg-yellow-400' :
                    'bg-emerald-400';

                  const statusCounts = { available: 0, reserved: 0, sold: 0 };
                  venueSeats.forEach(s => {
                    const st = seatStatusMap.get(s.id) || 'available';
                    if (st in statusCounts) statusCounts[st as keyof typeof statusCounts]++;
                  });

                  return (
                    <div className="p-3">
                      {/* Legend */}
                      <div className="flex items-center gap-3 mb-3 text-[10px]">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400 inline-block"></span> Disponible ({statusCounts.available})</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block"></span> Reservado ({statusCounts.reserved})</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#EF4444] inline-block"></span> Vendido ({statusCounts.sold})</span>
                      </div>
                      {/* Sections */}
                      {Array.from(sectionMap.entries()).map(([secName, seats]) => (
                        <div key={secName} className="mb-3">
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">{secName}</p>
                          {/* Group by row */}
                          {(() => {
                            const rowMap = new Map<string, VenueSeat[]>();
                            seats.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach(s => {
                              const row = s.row_label || '—';
                              if (!rowMap.has(row)) rowMap.set(row, []);
                              rowMap.get(row)!.push(s);
                            });
                            return Array.from(rowMap.entries()).map(([rowLabel, rowSeats]) => (
                              <div key={rowLabel} className="flex items-center gap-0.5 mb-0.5">
                                <span className="text-[9px] font-bold text-gray-400 w-4 text-right mr-1">{rowLabel}</span>
                                {rowSeats.map(s => {
                                  const status = seatStatusMap.get(s.id) || 'available';
                                  return (
                                    <span
                                      key={s.id}
                                      title={`${rowLabel}${s.seat_number} — ${status}`}
                                      className={`w-3 h-3 rounded-sm ${statusColor(status)} cursor-default transition-transform hover:scale-150`}
                                    />
                                  );
                                })}
                              </div>
                            ));
                          })()}
                        </div>
                      ))}
                    </div>
                  );
                })()}
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
  const [allVenues, setAllVenues] = useState<Venue[]>([]);
  const [venueSeatCounts, setVenueSeatCounts] = useState<Map<string, number>>(new Map());
  const [venueSeatData, setVenueSeatData] = useState<Map<string, VenueSeat[]>>(new Map());
  const [venueFilter, setVenueFilter] = useState({ city: '', type: '' });
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
  const [eventDashboardData, setEventDashboardData] = useState<EventDashboard[]>([]);
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
      const [events, zones, orders, schedules, venues, dashboardData, venuesList] = await Promise.all([
        fetchAllEvents().catch(() => []),
        fetchZones().catch(() => []),
        fetchAllOrders().catch(() => []),
        fetchSchedules().catch(() => []),
        getVenueMap().catch(() => new Map<string, Venue>()),
        fetchEventDashboard().catch(() => [] as EventDashboard[]),
        fetchVenues().catch(() => [] as Venue[]),
      ]);

      setVenueMap(venues);
      setAllVenues(venuesList);
      setEvents(events);
      setEventDashboardData(dashboardData);

      // Fetch venue_seats for Recintos display (counts + full data for drill-down)
      if (venuesList.length > 0) {
        Promise.all(venuesList.map(v => fetchVenueSeats(v.id).then(seats => ({ id: v.id, seats })).catch(() => ({ id: v.id, seats: [] as VenueSeat[] }))))
          .then(results => {
            const countMap = new Map<string, number>();
            const dataMap = new Map<string, VenueSeat[]>();
            results.forEach(r => {
              if (r.seats.length > 0) {
                countMap.set(r.id, r.seats.length);
                dataMap.set(r.id, r.seats);
              }
            });
            setVenueSeatCounts(countMap);
            setVenueSeatData(dataMap);
          });
      }

      // Build projects directly from events
      if (events.length > 0) {
        const projectsList: ProjectDisplay[] = events.map((event) => {
          const eventZones = zones.filter((z) => z.event_id === event.id);
          const eventOrders = orders.filter((o) => o.event_id === event.id);
          const eventSchedules = schedules.filter((s) => s.event_id === event.id);
          const ticketsSold = eventZones.reduce((sum, z) => sum + z.sold, 0);
          const totalTickets = eventZones.reduce((sum, z) => sum + z.available + z.sold, 0);
          const revenue = eventZones.reduce((sum, z) => sum + (z.sold * z.price), 0);

          const ticketTypeMap = new Map<string, { price: number; sold: number; available: number }>();
          eventZones.forEach((z) => {
            const existing = ticketTypeMap.get(z.zone_name);
            if (existing) { existing.sold += z.sold; existing.available += z.available; existing.price = Math.max(existing.price, z.price); }
            else { ticketTypeMap.set(z.zone_name, { price: z.price, sold: z.sold, available: z.available }); }
          });

          const isPast = isPastDate(event.start_date);

          return {
            id: event.id,
            name: event.name,
            producer: 'Francisco Paolo Dupeyron Gutierrez',
            image_url: event.image_url || '',
            status: (isPast && event.status === 'active' ? 'completed' : (event.status || 'draft')) as ProjectDisplay['status'],
            events: [{
              id: event.id,
              name: event.name,
              venue: getVenueName(event.venue_id, venues) + (getVenueCity(event.venue_id, venues) ? `, ${getVenueCity(event.venue_id, venues)}` : ''),
              venueId: event.venue_id,
              date: event.start_date ? formatDate(event.start_date) : 'TBD',
              image_url: event.image_url || '',
              ticketsSold, totalTickets, revenue,
              zones: eventZones.map((z, idx) => ({ id: `zone-${event.id}-${idx}`, nombre: z.zone_name, tipo: z.zone_type, precio: z.price || 0, capacidad: (z.available || 0) + (z.sold || 0), vendidos: z.sold || 0 })),
              schedules: eventSchedules.map((s) => ({ id: s.id, fecha: s.date, horaInicio: s.start_time, horaFin: s.end_time, activa: s.status === 'active', vendidos: s.sold_capacity })),
              orders: eventOrders.slice(0, 10).map((o) => ({ id: o.order_number, cliente: o.customer_name, email: o.customer_email, zona: o.zone_name, cantidad: o.quantity, total: o.total_price, estado: mapPaymentStatus(o.payment_status), fecha: o.purchased_at })),
              ticketTypes: Array.from(ticketTypeMap.entries()).map(([tName, data], idx) => ({ id: `tt-${idx}`, name: tName, price: data.price, sold: data.sold, available: data.available })).sort((a, b) => b.price - a.price),
            }],
            isPast,
            revenue, commission: revenue * 0.15,
            eventCount: 1,
            event_type: event.event_type,
          };
        });
        setProjects(projectsList);
      }
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
      estado: project.status === 'active' ? 'Publicado' : 'Borrador',
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
              p.id === archiveTarget ? { ...p, status: 'completed' as const, isPast: true } : p
            )
          );
        } else {
          toast.error(result.error || 'Error al archivar');
        }
      } else {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === archiveTarget ? { ...p, status: 'completed' as const, isPast: true } : p
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
      <div className="mx-auto max-w-[1200px] px-0 sm:px-4">
        {/* Header */}
        <div className="mb-3 sm:mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-base sm:text-xl font-bold text-gray-900">EVENTOS</h1>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-xs sm:text-sm focus:border-[#EF4444] focus:outline-none focus:ring-1 focus:ring-[#EF4444]"
            />
            <button
              onClick={() => { setEditingProject(null); setEditingProjectId(null); setModalOpen(true); }}
              className="rounded-lg bg-[#EF4444] px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-[#c5303c] whitespace-nowrap flex-shrink-0"
            >
              + Nuevo
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
                  ? 'bg-[#1a1a2e] text-white'
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
                      <h3 className="font-semibold text-gray-900 text-xs sm:text-sm truncate">
                        <span className="mr-1">{getEventTypeBadge(project.event_type)}</span>
                        {project.name}
                      </h3>
                      <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                        {project.producer}
                        {project.events[0]?.venue && <span className="text-gray-400 truncate max-w-[200px] inline-block align-bottom"> · {project.events[0].venue}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium text-white ${getStatusColor(project.status)}`}>
                      {getStatusLabel(project.status)}
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

                {isExpanded && <EventDetailPanel project={project} dashboardData={eventDashboardData} venueMap={venueMap} />}
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
              className="text-sm text-[#EF4444] font-medium hover:underline"
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
          venues={allVenues}
          existingProducers={[...new Set(projects.map(p => p.producer).filter(Boolean))].sort()}
        />

        <ConfirmDialog
          open={archiveTarget !== null}
          title="Archivar Proyecto"
          message="Este proyecto se movera a la seccion de pasados. Puedes reactivarlo despues."
          onConfirm={handleArchiveConfirm}
          onCancel={() => setArchiveTarget(null)}
        />
      </div>

      {/* ====== RECINTOS — enriched with filters ====== */}
      {allVenues.length > 0 && (() => {
        const cities = [...new Set(allVenues.map(v => v.city).filter(Boolean))].sort();
        // Derive venue seat type from events' zone_types (Drive ASIENTOS.jpeg: ga/reserved/hybrid)
        const getVenueSeatType = (v: Venue): 'parado' | 'sentado' | 'mixto' => {
          const zoneTypes = new Set(
            projects.flatMap(p => p.events.filter(e => e.venueId === v.id).flatMap(e => e.zones.map(z => z.tipo))).filter(Boolean)
          );
          const hasGA = zoneTypes.has('ga');
          const hasReserved = zoneTypes.has('reserved') || zoneTypes.has('numbered');
          if (hasGA && hasReserved) return 'mixto';
          if (hasReserved) return 'sentado';
          if (hasGA) return 'parado';
          return v.has_seatmap ? 'sentado' : 'parado';
        };
        const seatLabel = (t: string) => t === 'sentado' ? 'Numerado' : t === 'mixto' ? 'Mixto' : 'General';
        const seatBadge = (t: string) => t === 'sentado' ? 'badge-reserved' : t === 'mixto' ? 'badge-hybrid' : 'badge-ga';
        const seatDesc = (t: string) => t === 'sentado' ? 'Fila y número específico' : t === 'mixto' ? 'Zonas GA + numeradas' : 'Admisión general';
        const filtered = allVenues.filter(v => {
          if (venueFilter.city && v.city !== venueFilter.city) return false;
          if (venueFilter.type && getVenueSeatType(v) !== venueFilter.type) return false;
          return true;
        });
        return (
        <div className="section-card mt-4">
          <div className="section-card-header">
            <span className="section-card-title">🏟️ Recintos ({filtered.length}{filtered.length !== allVenues.length ? `/${allVenues.length}` : ''})</span>
            <div className="flex gap-2 ml-auto">
              <select value={venueFilter.city} onChange={e => setVenueFilter(f => ({...f, city: e.target.value}))} className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#EF4444]">
                <option value="">Todas las ciudades</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={venueFilter.type} onChange={e => setVenueFilter(f => ({...f, type: e.target.value}))} className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#EF4444]">
                <option value="">Todos los tipos</option>
                <option value="parado">General (GA)</option>
                <option value="sentado">Numerado</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>
          </div>
          <div className="section-card-body overflow-x-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th className="text-center">Ubicación</th>
                  <th className="text-center">Capacidad</th>
                  <th className="hidden sm:table-cell text-center">Timezone</th>
                  <th className="hidden sm:table-cell text-center">Mapa</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => {
                  const venueEvents = events.filter(e => e.venue_id === v.id);
                  const geo = [v.city, v.state, v.country].filter(Boolean).join(', ');
                  const isExp = expandedVenueId === v.id;
                  // Get zone types for this venue's events
                  const venueZoneTypes = [...new Set(
                    projects.flatMap(p => p.events.filter(e => e.venueId === v.id).flatMap(e => e.zones.map(z => z.tipo))).filter(Boolean)
                  )];
                  return (
                    <React.Fragment key={v.id}>
                    <tr className={`cursor-pointer ${isExp ? 'bg-red-50' : ''}`} onClick={() => setExpandedVenueId(isExp ? null : v.id)}>
                      <td>
                        <div className="flex items-center gap-1">
                          <svg className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isExp ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          <div>
                            <div className="font-bold">{v.name}</div>
                            {venueEvents.length > 0 && <div className="text-[10px] text-gray-400">{venueEvents.length} evento{venueEvents.length > 1 ? 's' : ''}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="text-center">{geo || '—'}</td>
                      <td className="text-center font-bold">
                        {v.capacity?.toLocaleString() || '—'}
                        {venueSeatCounts.get(v.id) ? <span className="block text-[9px] text-gray-400 font-normal">{venueSeatCounts.get(v.id)} asientos</span> : null}
                      </td>
                      <td className="hidden sm:table-cell text-center text-gray-500 text-[10px]">{v.timezone === 'America/Mexico_City' ? 'CDMX' : v.timezone?.replace('America/', '') || '—'}</td>
                      <td className="hidden sm:table-cell text-center">
                        <a href={v.maps_url || `https://www.google.com/maps/search/${encodeURIComponent(v.name + ' ' + (v.city || '') + ' ' + (v.state || ''))}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:underline text-[10px]">📍 Maps</a>
                      </td>
                    </tr>
                    {/* Drill-down: events in this venue */}
                    {isExp && (
                      <tr>
                        <td colSpan={5} className="p-0 bg-[#f8f6f6]">
                          <div className="p-3 space-y-2">
                            {/* Venue info header */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <p className="text-xs font-bold text-gray-700">{v.name}</p>
                                <p className="text-[10px] text-gray-500">{geo} · Cap. {v.capacity?.toLocaleString() || '?'}{venueSeatCounts.get(v.id) ? ` · ${venueSeatCounts.get(v.id)} asientos mapeados` : ''}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Asientos:</span>
                                {(() => {
                                  const st = getVenueSeatType(v);
                                  return <span className={`badge ${seatBadge(st)}`}>{seatLabel(st)}</span>;
                                })()}
                                <span className="text-[10px] text-gray-400 italic">{seatDesc(getVenueSeatType(v))}</span>
                              </div>
                              </div>
                              <a href={v.maps_url || `https://www.google.com/maps/search/${encodeURIComponent(v.name + ' ' + (v.city || '') + ' ' + (v.state || ''))}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline">📍 Ver en Maps</a>
                            </div>
                            {/* SVG Layout Map — cached to prevent flickering */}
                            {(v.layout_svg_url || v.image_url) ? (
                              <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2 overflow-hidden">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Mapa del Recinto</p>
                                {v.layout_svg_url ? (
                                  <CachedSvgImage
                                    src={v.layout_svg_url}
                                    alt={`Mapa ${v.name}`}
                                    className="w-full max-h-48 object-contain rounded"
                                  />
                                ) : (
                                  <img
                                    src={v.image_url!}
                                    alt={`Mapa ${v.name}`}
                                    className="w-full max-h-48 object-contain rounded"
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="mt-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-center">
                                <p className="text-[10px] text-gray-400">Sin mapa de recinto configurado</p>
                              </div>
                            )}
                            {/* Events in this venue */}
                            <p className="text-[10px] font-bold text-gray-500 uppercase mt-2">Eventos ({venueEvents.length})</p>
                            {venueEvents.length > 0 ? (
                              <div className="overflow-x-auto"><table className="w-full text-xs">
                                <thead><tr className="text-[10px] text-gray-500 border-b border-gray-200">
                                  <th className="text-left py-1 px-2">Evento</th>
                                  <th className="text-center py-1 px-2">Asientos</th>
                                  <th className="text-center py-1 px-2 hidden sm:table-cell">Fecha</th>
                                  <th className="text-center py-1 px-2">Status</th>
                                </tr></thead>
                                <tbody>
                                  {venueEvents.map(ev => {
                                    const proj = projects.find(p => p.events.some(e => e.id === ev.id));
                                    const evZones = proj?.events.find(e => e.id === ev.id)?.zones || [];
                                    const zTypes = [...new Set(evZones.map(z => z.tipo).filter(Boolean))];
                                    // Event emoji based on name keywords
                                    const nm = (ev.name || '').toLowerCase();
                                    const emoji = nm.includes('sinfón') || nm.includes('orquest') ? '🎵' : nm.includes('teatro') || nm.includes('obra') || nm.includes('mariposa') ? '🎭' : nm.includes('karen') || nm.includes('comedia') ? '😂' : nm.includes('infierno') || nm.includes('horror') ? '🔥' : nm.includes('lucero') ? '⭐' : '🎪';
                                    return (
                                      <tr key={ev.id} className="border-b border-gray-100">
                                        <td className="py-1.5 px-2">
                                          <span className="font-bold">{emoji} {ev.name}</span>
                                          <span className="ml-1.5">{getEventTypeBadge(ev.event_type)}</span>
                                        </td>
                                        <td className="py-1.5 px-2 text-center">{zTypes.length > 0 ? zTypes.map((t, i) => {
                                          const lbl = (t === 'reserved' || t === 'numbered') ? 'Numerado' : t === 'ga' ? 'General' : 'Mixto';
                                          const cls = (t === 'reserved' || t === 'numbered') ? 'badge-reserved' : t === 'ga' ? 'badge-ga' : 'badge-hybrid';
                                          return <span key={i} className={`badge ${cls} mr-0.5`}>{lbl}</span>;
                                        }) : <span className="badge badge-ga">General</span>}</td>
                                        <td className="py-1.5 px-2 text-center text-gray-500 hidden sm:table-cell">{ev.start_date ? new Date(ev.start_date).toLocaleDateString('es-MX', {day:'numeric',month:'short'}) : '—'}</td>
                                        <td className="py-1.5 px-2 text-center"><span className={`badge ${ev.status === 'active' ? 'badge-success' : ev.status === 'draft' ? 'badge-warning' : 'badge-info'}`}>{ev.status === 'active' ? 'Activo' : ev.status || '—'}</span></td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table></div>
                            ) : (
                              <p className="text-xs text-gray-400 py-2">Sin eventos registrados</p>
                            )}
                            {/* Venue Seats Summary */}
                            {(() => {
                              const seats = venueSeatData.get(v.id);
                              if (!seats || seats.length === 0) return null;
                              // Group seats by section
                              const sectionMap = new Map<string, { count: number; rows: Set<string> }>();
                              seats.forEach(s => {
                                const sec = s.section || 'General';
                                const existing = sectionMap.get(sec) || { count: 0, rows: new Set<string>() };
                                existing.count++;
                                if (s.row_label) existing.rows.add(s.row_label);
                                sectionMap.set(sec, existing);
                              });
                              const sections = Array.from(sectionMap.entries()).sort((a, b) => b[1].count - a[1].count);
                              return (
                                <div className="mt-2">
                                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Asientos Mapeados ({seats.length})</p>
                                  <div className="overflow-x-auto"><table className="w-full text-xs">
                                    <thead className="bg-[#1a1a2e] text-white">
                                      <tr>
                                        <th className="px-3 py-1.5 text-left text-[10px] font-bold">Sección</th>
                                        <th className="px-3 py-1.5 text-right text-[10px] font-bold">Asientos</th>
                                        <th className="px-3 py-1.5 text-right text-[10px] font-bold">Filas</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sections.map(([sec, data], i) => (
                                        <tr key={i} className="border-b border-gray-100">
                                          <td className="px-3 py-1.5 font-bold">{sec}</td>
                                          <td className="px-3 py-1.5 text-right">{data.count}</td>
                                          <td className="px-3 py-1.5 text-right text-gray-500">{data.rows.size > 0 ? data.rows.size : '—'}</td>
                                        </tr>
                                      ))}
                                      {sections.length > 1 && (
                                        <tr className="bg-[#1a1a2e] text-white font-bold">
                                          <td className="px-3 py-1.5">Total</td>
                                          <td className="px-3 py-1.5 text-right">{seats.length}</td>
                                          <td className="px-3 py-1.5 text-right">{new Set(seats.map(s => s.row_label).filter(Boolean)).size || '—'}</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table></div>
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-400">Sin recintos con ese filtro</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
