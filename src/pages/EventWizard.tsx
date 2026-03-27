'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';

/* ─── Constants ─── */
const CATEGORIES = ['teatro', 'concierto', 'festival', 'standup', 'comedia', 'musical', 'otro'];
const ZONE_COLORS = ['#E63946', '#2A7AE8', '#E88D2A', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4'];
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const STEP_LABELS = ['Info', 'Fechas', 'Zonas', 'Organizador', 'Revisión'];
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);

/* ─── Types ─── */
interface Venue {
  id: string; name: string; slug: string; address: string; city: string; state: string;
  timezone: string; capacity: number; has_seatmap: boolean; layout_svg_url: string | null;
}
interface VenueSection { id: string; name: string; slug: string; section_type: string; capacity: number; }

interface ZoneForm {
  zone_name: string; zone_type: 'ga' | 'reserved'; price: number; original_price: number;
  total_capacity: number; color: string; has_2x1: boolean;
}
interface ScheduleForm {
  date: string; start_time: string; end_time: string; total_capacity: number;
  staff_pin: string; staff_phone: string; staff_email: string;
}
interface EventForm {
  name: string; slug: string; venue_id: string; category: string;
  description: string; long_description: string; quote: string;
  image_url: string; poster_url: string; card_url: string;
  seo_title: string; seo_description: string;
  show_remaining: boolean; featured: boolean; sort_order: number;
}

interface Props { open: boolean; onClose: () => void; onCreated: () => void; }

/* ─── Helpers ─── */
function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function rPin(): string { return String(Math.floor(100000 + Math.random() * 900000)); }

async function proxyFetch<T>(path: string, query?: string): Promise<T> {
  const params = new URLSearchParams();
  params.set('path', path);
  if (query) {
    const qs = new URLSearchParams(query);
    qs.forEach((v, k) => params.set(k, v));
  }
  const res = await fetch(`/api/supabase-proxy?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  return res.json();
}

/* ─── Styles ─── */
const inpCls = 'w-full rounded-lg border border-gray-700 bg-[#1a1a1a] px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#EF4444] focus:outline-none transition-colors';
const lblCls = 'block text-xs text-gray-400 mb-1';
const cardCls = 'bg-[#111] rounded-xl p-4 border border-gray-800';

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function EventWizard({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  // Venues
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueSections, setVenueSections] = useState<VenueSection[]>([]);

  // Step 1: Event Info
  const [ev, setEv] = useState<EventForm>({
    name: '', slug: '', venue_id: '', category: 'teatro',
    description: '', long_description: '', quote: '',
    image_url: '', poster_url: '', card_url: '',
    seo_title: '', seo_description: '',
    show_remaining: false, featured: false, sort_order: 0,
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [seoTitleEdited, setSeoTitleEdited] = useState(false);
  const [seoDescEdited, setSeoDescEdited] = useState(false);

  // Step 2: Schedules
  const [schedules, setSchedules] = useState<ScheduleForm[]>([
    { date: '', start_time: '20:00', end_time: '', total_capacity: 0, staff_pin: rPin(), staff_phone: '', staff_email: '' },
  ]);
  const [durationMin, setDurationMin] = useState(90);

  // Recurring helper
  const [showRecHelper, setShowRecHelper] = useState(false);
  const [recDay, setRecDay] = useState(6); // Saturday
  const [recTime, setRecTime] = useState('20:00');
  const [recFrom, setRecFrom] = useState('');
  const [recTo, setRecTo] = useState('');

  // Step 3: Zones
  const [zones, setZones] = useState<ZoneForm[]>([
    { zone_name: 'General', zone_type: 'ga', price: 0, original_price: 0, total_capacity: 100, color: ZONE_COLORS[0], has_2x1: false },
  ]);

  // Step 4: Organizer & Commission
  const [orgName, setOrgName] = useState('');
  const [orgPhone, setOrgPhone] = useState('5573933510');
  const [orgEmail, setOrgEmail] = useState('paolo@dulos.io');
  const [commRate, setCommRate] = useState(15);

  // Selected venue
  const selVenue = useMemo(() => venues.find(v => v.id === ev.venue_id) || null, [venues, ev.venue_id]);
  const hasReservedSections = useMemo(() => venueSections.some(s => s.section_type === 'reserved'), [venueSections]);
  const venueBadge = useMemo(() => {
    if (!selVenue) return '';
    if (hasReservedSections) {
      const hasGA = venueSections.some(s => s.section_type === 'ga') || venueSections.length === 0;
      return hasGA ? 'Mixto' : 'Reserved';
    }
    return 'GA';
  }, [selVenue, hasReservedSections, venueSections]);

  // ─── Load venues ───
  useEffect(() => {
    if (!open) return;
    proxyFetch<Venue[]>('venues', 'order=name.asc').then(setVenues).catch(() => setVenues([]));
  }, [open]);

  // ─── Load venue sections when venue changes ───
  useEffect(() => {
    if (!ev.venue_id) { setVenueSections([]); return; }
    proxyFetch<VenueSection[]>('venue_sections', `venue_id=eq.${ev.venue_id}&order=sort_order.asc`)
      .then(setVenueSections)
      .catch(() => setVenueSections([]));
  }, [ev.venue_id]);

  // ─── Auto-slug from name + venue ───
  useEffect(() => {
    if (slugEdited || !ev.name) return;
    const venueSlug = selVenue?.slug || '';
    const base = slugify(ev.name);
    const full = venueSlug ? `${base}-${venueSlug}` : base;
    setEv(p => ({ ...p, slug: full }));
  }, [ev.name, selVenue, slugEdited]);

  // ─── Auto SEO ───
  useEffect(() => {
    if (!seoTitleEdited && ev.name) {
      const venue = selVenue?.name || '';
      const city = selVenue?.city || '';
      setEv(p => ({ ...p, seo_title: `${p.name}${venue ? ` | ${venue}` : ''}${city ? ` ${city}` : ''} | Boletos sin comisiones` }));
    }
  }, [ev.name, selVenue, seoTitleEdited]);

  useEffect(() => {
    if (!seoDescEdited && ev.description) {
      setEv(p => ({ ...p, seo_description: p.description.slice(0, 160) }));
    }
  }, [ev.description, seoDescEdited]);

  // ─── Auto end_time from duration ───
  useEffect(() => {
    if (!durationMin) return;
    setSchedules(prev => prev.map(s => {
      if (!s.start_time) return s;
      const [h, m] = s.start_time.split(':').map(Number);
      const total = h * 60 + m + durationMin;
      const eh = Math.floor(total / 60) % 24;
      const em = total % 60;
      return { ...s, end_time: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}` };
    }));
  }, [durationMin]);

  // ─── Auto capacity from zones ───
  const totalZoneCapacity = useMemo(() => zones.reduce((s, z) => s + (z.total_capacity || 0), 0), [zones]);

  // ─── Reset on close ───
  useEffect(() => {
    if (open) return;
    setStep(1); setError(''); setWarnings([]); setSubmitting(false); setSlugEdited(false);
    setSeoTitleEdited(false); setSeoDescEdited(false);
    setEv({ name: '', slug: '', venue_id: '', category: 'teatro', description: '', long_description: '', quote: '', image_url: '', poster_url: '', card_url: '', seo_title: '', seo_description: '', show_remaining: false, featured: false, sort_order: 0 });
    setZones([{ zone_name: 'General', zone_type: 'ga', price: 0, original_price: 0, total_capacity: 100, color: ZONE_COLORS[0], has_2x1: false }]);
    setSchedules([{ date: '', start_time: '20:00', end_time: '', total_capacity: 0, staff_pin: rPin(), staff_phone: '', staff_email: '' }]);
    setCommRate(15); setDurationMin(90); setShowRecHelper(false);
    setOrgName(''); setOrgPhone('5573933510'); setOrgEmail('paolo@dulos.io');
  }, [open]);

  // ─── Generate recurring schedules ───
  const generateRecurring = () => {
    if (!recFrom || !recTo) return;
    const start = new Date(recFrom + 'T12:00:00');
    const end = new Date(recTo + 'T12:00:00');
    const newSchedules: ScheduleForm[] = [];
    const d = new Date(start);
    while (d <= end) {
      if (d.getDay() === recDay) {
        const dateStr = d.toISOString().split('T')[0];
        const [h, m] = recTime.split(':').map(Number);
        const total = h * 60 + m + durationMin;
        const eh = Math.floor(total / 60) % 24;
        const em = total % 60;
        newSchedules.push({
          date: dateStr,
          start_time: recTime,
          end_time: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
          total_capacity: 0,
          staff_pin: rPin(),
          staff_phone: '',
          staff_email: '',
        });
      }
      d.setDate(d.getDate() + 1);
    }
    if (newSchedules.length > 0) {
      setSchedules(newSchedules);
      setShowRecHelper(false);
      toast.success(`${newSchedules.length} fechas generadas`);
    } else {
      toast.error('No se encontraron fechas para el día seleccionado');
    }
  };

  // ─── Validation ───
  function canNext(): boolean {
    if (step === 1) return !!(ev.name && ev.venue_id && ev.slug);
    if (step === 2) return schedules.length > 0 && schedules.every(s => s.date && s.start_time);
    if (step === 3) return zones.length > 0 && zones.every(z => z.zone_name && z.price > 0 && (z.zone_type === 'reserved' || z.total_capacity > 0));
    return true;
  }

  // ─── Compute warnings ───
  const computeWarnings = useCallback((): string[] => {
    const w: string[] = [];
    if (selVenue && !selVenue.layout_svg_url) w.push('El venue no tiene SVG — el evento no mostrará mapa del venue');
    if (!ev.image_url) w.push('Sin imagen principal — el card del evento se verá vacío');
    for (const z of zones) {
      if (z.price > 0 && !z.original_price) {
        // Not necessarily a warning
      }
    }
    const totalGA = zones.filter(z => z.zone_type === 'ga').reduce((s, z) => s + z.total_capacity, 0);
    if (selVenue && totalGA > selVenue.capacity) w.push(`Capacidad GA (${totalGA}) excede capacidad del venue (${selVenue.capacity})`);
    return w;
  }, [ev, zones, selVenue]);

  // ─── Submit ───
  async function handleSubmit(status: 'draft' | 'active') {
    setSubmitting(true); setError('');
    try {
      const payload = {
        name: ev.name,
        slug: ev.slug,
        venue_id: ev.venue_id,
        category: ev.category,
        description: ev.description,
        long_description: ev.long_description,
        quote: ev.quote,
        image_url: ev.image_url,
        poster_url: ev.poster_url,
        card_url: ev.card_url,
        seo_title: ev.seo_title,
        seo_description: ev.seo_description,
        show_remaining: ev.show_remaining,
        featured: ev.featured,
        sort_order: ev.sort_order,
        status,
        zones: zones.map(z => ({
          zone_name: z.zone_name,
          zone_type: z.zone_type,
          price: z.price,
          original_price: z.original_price || null,
          total_capacity: z.zone_type === 'ga' ? z.total_capacity : z.total_capacity,
          color: z.color,
          has_2x1: z.has_2x1,
        })),
        schedules: schedules.map(s => ({
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time || null,
          total_capacity: s.total_capacity || totalZoneCapacity,
          staff_pin: s.staff_pin,
          staff_phone: orgPhone || '5573933510',
          staff_email: orgEmail || 'paolo@dulos.io',
        })),
        commission_rate: commRate / 100,
        venue_timezone: selVenue?.timezone || 'America/Mexico_City',
      };

      const res = await fetch('/api/admin/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear evento');

      toast.success(`✅ Evento creado: ${data.summary.zones} zonas, ${data.summary.schedules} fechas, ${data.summary.inventory_rows} inventario`);
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Error al crear evento');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  /* ─── Shared UI helpers ─── */
  const XBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="absolute right-3 top-3 text-gray-600 hover:text-red-400 transition-colors" title="Eliminar">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  );

  const stepWarnings = step === 5 ? computeWarnings() : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0a0a0a] border border-gray-800 shadow-2xl">
        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-500 hover:text-white transition-colors z-10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        {/* Step indicator */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-bold text-white mb-4">Crear Evento</h2>
          <div className="flex items-center gap-1 mb-2">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const active = n === step;
              const done = n < step;
              return (
                <div key={n} className="flex items-center gap-1.5 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${active ? 'bg-[#EF4444] text-white' : done ? 'bg-[#EF4444]/30 text-[#EF4444]' : 'bg-gray-800 text-gray-500'}`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`text-xs hidden sm:inline ${active ? 'text-white font-medium' : 'text-gray-500'}`}>{label}</span>
                  {i < STEP_LABELS.length - 1 && <div className={`flex-1 h-px mx-1 ${done ? 'bg-[#EF4444]/40' : 'bg-gray-800'}`}/>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-6">

          {/* ═══ STEP 1: EVENT INFO ═══ */}
          {step === 1 && (
            <div className="space-y-4">
              <div><label className={lblCls}>Nombre del evento *</label><input className={inpCls} value={ev.name} onChange={e => setEv(p => ({ ...p, name: e.target.value }))} placeholder="Archivo Confidencial: CÁMARA BLANCA"/></div>

              <div>
                <label className={lblCls}>Venue *</label>
                <select value={ev.venue_id} onChange={e => setEv(p => ({ ...p, venue_id: e.target.value }))} className={inpCls}>
                  <option value="">— Seleccionar venue —</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}
                </select>
              </div>

              {/* Venue preview */}
              {selVenue && (
                <div className={cardCls}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{selVenue.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{[selVenue.address, selVenue.city, selVenue.state].filter(Boolean).join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${venueBadge === 'GA' ? 'bg-green-900/50 text-green-400' : venueBadge === 'Reserved' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'}`}>
                        {venueBadge}
                      </span>
                      <span className="text-xs text-gray-500">{selVenue.capacity} cap</span>
                    </div>
                  </div>
                  {selVenue.layout_svg_url && (
                    <div className="mt-3 h-20 bg-[#0a0a0a] rounded overflow-hidden flex items-center justify-center">
                      <img src={selVenue.layout_svg_url} alt="Mapa" className="max-h-full opacity-60"/>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className={lblCls}>Slug (auto)</label>
                <input className={`${inpCls} opacity-60 cursor-not-allowed`} value={ev.slug} readOnly tabIndex={-1}/>
                <p className="text-[10px] text-gray-600 mt-1">Auto-generado: nombre-venue-ciudad</p>
              </div>

              <div>
                <label className={lblCls}>Categoría *</label>
                <select className={inpCls} value={ev.category} onChange={e => setEv(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>

              <div><label className={lblCls}>Descripción corta</label><textarea className={`${inpCls} min-h-[60px] resize-y`} value={ev.description} onChange={e => setEv(p => ({ ...p, description: e.target.value }))} placeholder="Para el card del evento..."/></div>

              <div><label className={lblCls}>Descripción larga</label><textarea className={`${inpCls} min-h-[80px] resize-y`} value={ev.long_description} onChange={e => setEv(p => ({ ...p, long_description: e.target.value }))} placeholder="Para la página del evento..."/></div>

              <div><label className={lblCls}>Quote</label><input className={inpCls} value={ev.quote} onChange={e => setEv(p => ({ ...p, quote: e.target.value }))} placeholder="Frase destacada..."/></div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className={lblCls}>Imagen principal (URL)</label><input className={inpCls} value={ev.image_url} onChange={e => setEv(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..."/></div>
                <div><label className={lblCls}>Poster (URL)</label><input className={inpCls} value={ev.poster_url} onChange={e => setEv(p => ({ ...p, poster_url: e.target.value }))} placeholder="Vertical, redes"/></div>
                <div><label className={lblCls}>Card (URL)</label><input className={inpCls} value={ev.card_url} onChange={e => setEv(p => ({ ...p, card_url: e.target.value }))} placeholder="Horizontal, preview"/></div>
              </div>

              {/* SEO — collapsible */}
              <details className="group">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">SEO (auto-generado) ▸</summary>
                <div className="mt-3 space-y-3">
                  <div><label className={lblCls}>SEO Title (auto)</label><input className={`${inpCls} opacity-60 cursor-not-allowed`} value={ev.seo_title} readOnly tabIndex={-1}/></div>
                  <div><label className={lblCls}>SEO Description</label><textarea className={`${inpCls} min-h-[50px] resize-y`} value={ev.seo_description} onChange={e => { setSeoDescEdited(true); setEv(p => ({ ...p, seo_description: e.target.value })); }}/></div>
                </div>
              </details>
            </div>
          )}

          {/* ═══ STEP 2: SCHEDULES ═══ */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className={lblCls + ' mb-0'}>Duración (min)</label>
                  <input type="number" className={`${inpCls} w-20`} value={durationMin} onChange={e => setDurationMin(Number(e.target.value))} min={15} step={15}/>
                </div>
                <button onClick={() => setShowRecHelper(!showRecHelper)} className="text-xs text-[#EF4444] hover:text-red-300 transition-colors">
                  {showRecHelper ? 'Cerrar' : '🔄 Generar fechas recurrentes'}
                </button>
              </div>

              {/* Recurring helper */}
              {showRecHelper && (
                <div className={`${cardCls} space-y-3`}>
                  <p className="text-xs font-medium text-white">Generar fechas recurrentes</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className={lblCls}>Día</label>
                      <select className={inpCls} value={recDay} onChange={e => setRecDay(Number(e.target.value))}>
                        {DAYS_ES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>
                    <div><label className={lblCls}>Hora</label><input type="time" className={inpCls} value={recTime} onChange={e => setRecTime(e.target.value)}/></div>
                    <div><label className={lblCls}>Desde</label><input type="date" className={inpCls} value={recFrom} onChange={e => setRecFrom(e.target.value)}/></div>
                    <div><label className={lblCls}>Hasta</label><input type="date" className={inpCls} value={recTo} onChange={e => setRecTo(e.target.value)}/></div>
                  </div>
                  <button onClick={generateRecurring} className="text-xs bg-[#EF4444] text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                    Generar
                  </button>
                </div>
              )}

              {/* Schedule list */}
              {schedules.map((s, i) => (
                <div key={i} className={`${cardCls} relative`}>
                  {schedules.length > 1 && <XBtn onClick={() => setSchedules(ss => ss.filter((_, j) => j !== i))}/>}
                  <p className="text-xs text-gray-500 font-medium mb-3">
                    Fecha {i + 1}
                    {s.date && <span className="text-gray-600 ml-2">· {DAYS_ES[new Date(s.date + 'T12:00').getDay()]}</span>}
                    <span className="text-gray-600 ml-2">· PIN: {s.staff_pin}</span>
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={lblCls}>Fecha *</label><input type="date" className={inpCls} value={s.date} onChange={e => setSchedules(ss => ss.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}/></div>
                    <div><label className={lblCls}>Hora inicio *</label><input type="time" className={inpCls} value={s.start_time} onChange={e => { const v = e.target.value; setSchedules(ss => ss.map((x, j) => { if (j !== i) return x; const [h, m] = v.split(':').map(Number); const total = h * 60 + m + durationMin; const eh = Math.floor(total / 60) % 24; const em = total % 60; return { ...x, start_time: v, end_time: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}` }; })); }}/></div>
                    <div><label className={lblCls}>Hora fin</label><input type="time" className={inpCls} value={s.end_time} onChange={e => setSchedules(ss => ss.map((x, j) => j === i ? { ...x, end_time: e.target.value } : x))}/></div>
                  </div>
                </div>
              ))}
              <button onClick={() => setSchedules(ss => [...ss, { date: '', start_time: '20:00', end_time: '', total_capacity: 0, staff_pin: rPin(), staff_phone: '', staff_email: '' }])} className="w-full py-2.5 rounded-lg border border-dashed border-gray-700 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors">+ Agregar fecha</button>
            </div>
          )}

          {/* ═══ STEP 3: ZONES ═══ */}
          {step === 3 && (
            <div className="space-y-4">
              {!hasReservedSections && (
                <div className="text-xs text-gray-500 bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-800">
                  Este venue solo admite zonas de <b className="text-gray-300">Admisión General</b>. Para zonas con asientos numerados, primero agrega secciones de tipo &quot;reserved&quot; al venue.
                </div>
              )}
              {zones.map((z, i) => (
                <div key={i} className={`${cardCls} relative`}>
                  {zones.length > 1 && <XBtn onClick={() => setZones(zs => zs.filter((_, j) => j !== i))}/>}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }}/>
                    <p className="text-xs text-gray-500 font-medium">Zona {i + 1}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className={lblCls}>Nombre *</label><input className={inpCls} value={z.zone_name} onChange={e => setZones(zs => zs.map((x, j) => j === i ? { ...x, zone_name: e.target.value } : x))} placeholder="VIP, General..."/></div>
                    <div>
                      <label className={lblCls}>Tipo</label>
                      <select className={inpCls} value={z.zone_type} onChange={e => setZones(zs => zs.map((x, j) => j === i ? { ...x, zone_type: e.target.value as 'ga' | 'reserved' } : x))}
                        disabled={!hasReservedSections}>
                        <option value="ga">General (GA)</option>
                        {hasReservedSections && <option value="reserved">Reserved</option>}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div><label className={lblCls}>Precio *</label><input type="number" className={inpCls} value={z.price || ''} min={0} onChange={e => setZones(zs => zs.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))}/></div>
                    <div><label className={lblCls}>Precio original</label><input type="number" className={inpCls} value={z.original_price || ''} min={0} placeholder="Tachado" onChange={e => setZones(zs => zs.map((x, j) => j === i ? { ...x, original_price: Number(e.target.value) } : x))}/></div>
                    <div>
                      <label className={lblCls}>Capacidad {z.zone_type === 'reserved' ? '(mapeo)' : '*'}</label>
                      <input type="number" className={inpCls} value={z.total_capacity || ''} min={1}
                        disabled={z.zone_type === 'reserved'}
                        placeholder={z.zone_type === 'reserved' ? 'Se calcula del mapeo' : ''}
                        onChange={e => setZones(zs => zs.map((x, j) => j === i ? { ...x, total_capacity: Number(e.target.value) } : x))}/>
                    </div>
                    <div>
                      <label className={lblCls}>Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" value={z.color} onChange={e => setZones(zs => zs.map((x, j) => j === i ? { ...x, color: e.target.value } : x))}/>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setZones(zs => [...zs, { zone_name: '', zone_type: 'ga', price: 0, original_price: 0, total_capacity: 100, color: ZONE_COLORS[zs.length % ZONE_COLORS.length], has_2x1: false }])} className="w-full py-2.5 rounded-lg border border-dashed border-gray-700 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors">+ Agregar zona</button>

              {/* Capacity check */}
              <div className="text-xs text-gray-500 flex justify-between px-1">
                <span>Total zonas: {totalZoneCapacity} boletos</span>
                {selVenue && <span className={totalZoneCapacity > selVenue.capacity ? 'text-red-400' : 'text-green-400'}>Venue: {selVenue.capacity} cap {totalZoneCapacity > selVenue.capacity ? '⚠️ excede' : '✓'}</span>}
              </div>
            </div>
          )}

          {/* ═══ STEP 4: ORGANIZADOR ═══ */}
          {step === 4 && (
            <div className="space-y-4">
              <div className={cardCls}>
                <p className="text-xs text-gray-500 font-medium mb-3">Contacto del organizador</p>
                <div className="space-y-3">
                  <div><label className={lblCls}>Nombre / Productora</label><input className={inpCls} value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Dulos Producciones"/></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lblCls}>Teléfono</label><input className={inpCls} value={orgPhone} onChange={e => setOrgPhone(e.target.value)} placeholder="55 7393 3510"/></div>
                    <div><label className={lblCls}>Email</label><input type="email" className={inpCls} value={orgEmail} onChange={e => setOrgEmail(e.target.value)} placeholder="paolo@dulos.io"/></div>
                  </div>
                </div>
              </div>

              <div className={cardCls}>
                <p className="text-xs text-gray-500 font-medium mb-3">Comisión Dulos</p>
                <div className="flex items-center gap-3">
                  <input type="number" className={`${inpCls} w-24`} value={commRate} step={1} min={0} max={100} onChange={e => setCommRate(Number(e.target.value))}/>
                  <span className="text-sm text-gray-400">%</span>
                </div>
              </div>

              <div className={cardCls}>
                <p className="text-xs text-gray-500 font-medium mb-3">Configuración</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" className="accent-[#EF4444]" checked={ev.show_remaining} onChange={e => setEv(p => ({ ...p, show_remaining: e.target.checked }))}/>
                    Mostrar boletos restantes
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" className="accent-[#EF4444]" checked={ev.featured} onChange={e => setEv(p => ({ ...p, featured: e.target.checked }))}/>
                    Evento destacado
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-300">Orden</label>
                    <input type="number" className={`${inpCls} w-20`} value={ev.sort_order} min={0} onChange={e => setEv(p => ({ ...p, sort_order: Number(e.target.value) }))}/>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 5: REVIEW ═══ */}
          {step === 5 && (
            <div className="space-y-4">
              {/* Venue */}
              <div className={cardCls}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Venue</p>
                <p className="text-sm font-bold text-white">{selVenue?.name || '—'}</p>
                <p className="text-xs text-gray-400">{[selVenue?.address, selVenue?.city].filter(Boolean).join(', ')} · Cap: {selVenue?.capacity} · <span className={`${venueBadge === 'GA' ? 'text-green-400' : 'text-blue-400'}`}>{venueBadge}</span></p>
              </div>

              {/* Event */}
              <div className={cardCls}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Evento</p>
                <p className="text-sm font-bold text-white">{ev.name}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                  <span>/{ev.slug}</span>
                  <span>{schedules.length === 1 ? 'Única fecha' : `Recurrente (${schedules.length} fechas)`}</span>
                  <span>{ev.category}</span>
                  {ev.image_url && <span className="text-green-400">✓ Imagen</span>}
                </div>
              </div>

              {/* Zones */}
              <div className={cardCls}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Zonas ({zones.length})</p>
                <div className="space-y-1.5">
                  {zones.map((z, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }}/>
                        <span className="text-white">{z.zone_name}</span>
                        <span className="text-gray-600">({z.zone_type})</span>
                      </div>
                      <div className="text-gray-400">
                        {fmt(z.price)}
                        {z.original_price > 0 && <span className="line-through text-gray-600 ml-1">{fmt(z.original_price)}</span>}
                        <span className="ml-2">{z.total_capacity} bol.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedules */}
              <div className={cardCls}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Fechas ({schedules.length})</p>
                <div className="space-y-1">
                  {schedules.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-white">{s.date} {s.start_time}{s.end_time ? `–${s.end_time}` : ''}</span>
                      <span className="text-gray-400">Cap: {s.total_capacity || totalZoneCapacity} · PIN: {s.staff_pin}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* What will be created */}
              <div className={cardCls}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Se creará</p>
                <div className="space-y-1 text-xs text-gray-300">
                  <p>✓ 1 evento ({schedules.length === 1 ? 'única fecha' : 'recurrente'})</p>
                  <p>✓ {zones.length} zona{zones.length > 1 ? 's' : ''} de boletos</p>
                  <p>✓ {schedules.length} fecha{schedules.length > 1 ? 's' : ''}</p>
                  <p>✓ {schedules.length * zones.length} registros de inventario</p>
                  <p>✓ Comisión: {commRate}%</p>
                </div>
              </div>

              {/* Warnings */}
              {stepWarnings.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-400 mb-1">⚠️ Warnings</p>
                  {stepWarnings.map((w, i) => <p key={i} className="text-xs text-yellow-400/80">• {w}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-sm text-red-300">{error}</div>}

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="px-5 py-2.5 rounded-lg border border-gray-700 text-gray-300 text-sm font-medium hover:bg-[#111] transition-colors">
              {step === 1 ? 'Cancelar' : '← Anterior'}
            </button>
            {step < 5 ? (
              <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="px-5 py-2.5 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Siguiente →
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => handleSubmit('draft')} disabled={submitting} className="px-5 py-2.5 rounded-lg border border-gray-600 text-gray-300 text-sm font-medium hover:bg-[#111] transition-colors disabled:opacity-40">
                  {submitting ? '...' : 'Crear Borrador'}
                </button>
                <button onClick={() => handleSubmit('active')} disabled={submitting} className="px-5 py-2.5 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                  {submitting && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {submitting ? 'Creando...' : 'Crear Activo'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}