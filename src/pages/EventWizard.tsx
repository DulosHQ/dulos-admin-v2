'use client';

import React, { useState, useEffect, useMemo } from 'react';

/* ─── Constants ─── */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const hdrs: Record<string, string> = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

const CATEGORIES = ['teatro', 'concierto', 'comedia', 'musical', 'otro'];
const EVENT_TYPES = ['single', 'recurring', 'multi'];
const ZONE_TYPES = ['general', 'reserved'];
const TIMEZONES = [
  'America/Mexico_City', 'America/Monterrey', 'America/Cancun',
  'America/Chihuahua', 'America/Tijuana', 'America/Hermosillo', 'America/Mazatlan',
];
const STEP_LABELS = ['Venue', 'Evento', 'Zonas', 'Funciones', 'Resumen'];

/* ─── Types ─── */
interface VenueOption { id: string; name: string; address: string; city: string; timezone: string; capacity: number; }
interface NewVenue { name: string; address: string; city: string; timezone: string; capacity: number; }
interface EventForm { name: string; slug: string; event_type: string; start_date: string; end_date: string; price_from: number; image_url: string; category: string; description: string; status: string; }
interface ZoneForm { zone_name: string; zone_type: string; price: number; total_capacity: number; }
interface FuncForm { date: string; start_time: string; end_time: string; total_capacity: number; staff_pin: string; staff_phone: string; staff_email: string; }
interface Props { open: boolean; onClose: () => void; onCreated: () => void; }

/* ─── Helpers ─── */
function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function rPin(): string { return String(Math.floor(100000 + Math.random() * 900000)); }
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);

async function supaPost<T>(table: string, data: unknown): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: hdrs, body: JSON.stringify(data) });
  if (!res.ok) { const b = await res.text().catch(() => ''); throw new Error(`POST ${table}: ${res.status} ${b}`); }
  const j = await res.json();
  return Array.isArray(j) ? j[0] : j;
}

/* ─── Styles ─── */
const inpCls = 'w-full rounded-lg border border-[#333] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';
const lblCls = 'block text-xs text-gray-400 mb-1';

/* ═══ COMPONENT ═══ */
export default function EventWizard({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [venueId, setVenueId] = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [nv, setNv] = useState<NewVenue>({ name: '', address: '', city: '', timezone: 'America/Mexico_City', capacity: 200 });

  // Step 2
  const [ev, setEv] = useState<EventForm>({ name: '', slug: '', event_type: 'single', start_date: '', end_date: '', price_from: 0, image_url: '', category: 'teatro', description: '', status: 'active' });
  const [slugEdited, setSlugEdited] = useState(false);

  // Step 3
  const [zones, setZones] = useState<ZoneForm[]>([{ zone_name: 'General', zone_type: 'general', price: 0, total_capacity: 100 }]);

  // Step 4
  const [funcs, setFuncs] = useState<FuncForm[]>([{ date: '', start_time: '20:00', end_time: '22:00', total_capacity: 0, staff_pin: rPin(), staff_phone: '', staff_email: '' }]);

  // Step 5
  const [commRate, setCommRate] = useState(0.15);

  // Fetch venues
  useEffect(() => {
    if (!open) return;
    fetch(`${SUPABASE_URL}/rest/v1/venues?order=name.asc`, { headers: hdrs }).then(r => r.json()).then(d => setVenues(d)).catch(() => setVenues([]));
  }, [open]);

  // Selected venue
  const selVenue = useMemo(() => {
    if (createNew) return { name: nv.name, address: nv.address, city: nv.city, timezone: nv.timezone, capacity: nv.capacity };
    return venues.find(v => v.id === venueId) || null;
  }, [venueId, createNew, nv, venues]);

  // Auto-slug
  useEffect(() => { if (!slugEdited && ev.name) setEv(p => ({ ...p, slug: slugify(p.name) })); }, [ev.name, slugEdited]);

  // Auto capacity from venue
  useEffect(() => {
    if (selVenue) setFuncs(p => p.map(f => f.total_capacity === 0 ? { ...f, total_capacity: selVenue.capacity } : f));
  }, [selVenue]);

  // Reset
  useEffect(() => {
    if (!open) {
      setStep(1); setError(''); setSubmitting(false); setVenueId(''); setCreateNew(false);
      setNv({ name: '', address: '', city: '', timezone: 'America/Mexico_City', capacity: 200 });
      setEv({ name: '', slug: '', event_type: 'single', start_date: '', end_date: '', price_from: 0, image_url: '', category: 'teatro', description: '', status: 'active' });
      setSlugEdited(false);
      setZones([{ zone_name: 'General', zone_type: 'general', price: 0, total_capacity: 100 }]);
      setFuncs([{ date: '', start_time: '20:00', end_time: '22:00', total_capacity: 0, staff_pin: rPin(), staff_phone: '', staff_email: '' }]);
      setCommRate(0.15);
    }
  }, [open]);

  // Validation
  function canNext(): boolean {
    if (step === 1) { if (createNew) return !!(nv.name && nv.address && nv.city && nv.capacity > 0); return !!venueId; }
    if (step === 2) return !!(ev.name && ev.slug && ev.start_date && ev.end_date);
    if (step === 3) return zones.length > 0 && zones.every(z => z.zone_name && z.price >= 0 && z.total_capacity > 0);
    if (step === 4) return funcs.length > 0 && funcs.every(f => f.date && f.start_time && f.total_capacity > 0);
    return true;
  }

  // Submit
  async function handleSubmit() {
    setSubmitting(true); setError('');
    try {
      let fVenueId = venueId;
      if (createNew) { const v = await supaPost<VenueOption>('venues', nv); fVenueId = v.id; }

      const created = await supaPost<{ id: string }>('events', { ...ev, venue_id: fVenueId });
      const eventId = created.id;

      const createdZones: { id: string; total_capacity: number }[] = [];
      for (const z of zones) {
        const cz = await supaPost<{ id: string; total_capacity: number }>('ticket_zones', { event_id: eventId, zone_name: z.zone_name, zone_type: z.zone_type, price: z.price, total_capacity: z.total_capacity, sold: 0, available: z.total_capacity });
        createdZones.push(cz);
      }

      const createdScheds: { id: string }[] = [];
      for (const f of funcs) {
        const cs = await supaPost<{ id: string }>('schedules', { event_id: eventId, date: f.date, start_time: f.start_time, end_time: f.end_time, total_capacity: f.total_capacity, staff_pin: f.staff_pin, staff_phone: f.staff_phone || null, staff_email: f.staff_email || null, status: 'active' });
        createdScheds.push(cs);
      }

      for (const s of createdScheds) {
        for (const z of createdZones) {
          await supaPost('schedule_inventory', { schedule_id: s.id, zone_id: z.id, sold: 0, available: z.total_capacity, reserved: 0 });
        }
      }

      await supaPost('event_commissions', { event_id: eventId, commission_rate: commRate });

      onCreated();
      onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error al crear evento'); }
    finally { setSubmitting(false); }
  }

  if (!open) return null;

  /* ─── Render helpers ─── */
  const XBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="absolute right-3 top-3 text-gray-500 hover:text-red-400 transition-colors" title="Eliminar">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0f0f0f] border border-[#222] shadow-2xl">
        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-500 hover:text-white transition-colors z-10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        {/* Step indicator */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-bold text-white mb-4">Crear Evento</h2>
          <div className="flex items-center justify-between mb-2">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const active = n === step;
              const done = n < step;
              return (
                <div key={n} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${active ? 'bg-[#E63946] text-white' : done ? 'bg-[#E63946]/30 text-[#E63946]' : 'bg-[#222] text-gray-500'}`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`text-xs hidden sm:inline ${active ? 'text-white font-medium' : 'text-gray-500'}`}>{label}</span>
                  {i < 4 && <div className={`flex-1 h-px mx-1 ${done ? 'bg-[#E63946]/40' : 'bg-[#222]'}`}/>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* ═══ STEP 1: VENUE ═══ */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={lblCls}>Venue</label>
                <select value={createNew ? '__new__' : venueId} onChange={e => { if (e.target.value === '__new__') { setCreateNew(true); setVenueId(''); } else { setCreateNew(false); setVenueId(e.target.value); } }} className={inpCls}>
                  <option value="">— Seleccionar venue —</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}
                  <option value="__new__">+ Crear nuevo venue</option>
                </select>
              </div>
              {createNew && (
                <div className="space-y-3 bg-[#141414] rounded-xl p-4 border border-[#282828]">
                  <p className="text-sm font-medium text-white mb-2">Nuevo Venue</p>
                  <div><label className={lblCls}>Nombre *</label><input className={inpCls} value={nv.name} onChange={e => setNv(v => ({ ...v, name: e.target.value }))} placeholder="Teatro Metropolitano"/></div>
                  <div><label className={lblCls}>Dirección *</label><input className={inpCls} value={nv.address} onChange={e => setNv(v => ({ ...v, address: e.target.value }))} placeholder="Av. Insurgentes Sur 123"/></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lblCls}>Ciudad *</label><input className={inpCls} value={nv.city} onChange={e => setNv(v => ({ ...v, city: e.target.value }))} placeholder="CDMX"/></div>
                    <div><label className={lblCls}>Timezone</label><select className={inpCls} value={nv.timezone} onChange={e => setNv(v => ({ ...v, timezone: e.target.value }))}>{TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('America/', '')}</option>)}</select></div>
                  </div>
                  <div><label className={lblCls}>Capacidad *</label><input type="number" className={inpCls} value={nv.capacity} onChange={e => setNv(v => ({ ...v, capacity: Number(e.target.value) }))} min={1}/></div>
                </div>
              )}
              {selVenue && !createNew && (
                <div className="bg-[#141414] rounded-xl p-4 border border-[#282828]">
                  <p className="text-sm font-bold text-white">{selVenue.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{selVenue.address}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>📍 {selVenue.city}</span>
                    <span>👤 Cap: {selVenue.capacity}</span>
                    <span>🕐 {selVenue.timezone?.replace('America/', '')}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP 2: EVENT DETAILS ═══ */}
          {step === 2 && (
            <div className="space-y-4">
              <div><label className={lblCls}>Nombre del evento *</label><input className={inpCls} value={ev.name} onChange={e => setEv(d => ({ ...d, name: e.target.value }))} placeholder="La Casa de Bernarda Alba"/></div>
              <div>
                <label className={lblCls}>Slug</label>
                <input className={inpCls} value={ev.slug} onChange={e => { setSlugEdited(true); setEv(d => ({ ...d, slug: e.target.value })); }} placeholder="la-casa-de-bernarda-alba"/>
                <p className="text-[10px] text-gray-600 mt-1">Auto-generado del nombre. Editable.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lblCls}>Tipo de evento</label><select className={inpCls} value={ev.event_type} onChange={e => setEv(d => ({ ...d, event_type: e.target.value }))}>{EVENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
                <div><label className={lblCls}>Categoría</label><select className={inpCls} value={ev.category} onChange={e => setEv(d => ({ ...d, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lblCls}>Fecha inicio *</label><input type="date" className={inpCls} value={ev.start_date} onChange={e => setEv(d => ({ ...d, start_date: e.target.value }))}/></div>
                <div><label className={lblCls}>Fecha fin *</label><input type="date" className={inpCls} value={ev.end_date} onChange={e => setEv(d => ({ ...d, end_date: e.target.value }))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lblCls}>Precio desde (MXN)</label><input type="number" className={inpCls} value={ev.price_from} onChange={e => setEv(d => ({ ...d, price_from: Number(e.target.value) }))} min={0}/></div>
                <div><label className={lblCls}>URL de imagen</label><input className={inpCls} value={ev.image_url} onChange={e => setEv(d => ({ ...d, image_url: e.target.value }))} placeholder="https://..."/></div>
              </div>
              <div><label className={lblCls}>Descripción</label><textarea className={`${inpCls} min-h-[80px] resize-y`} value={ev.description} onChange={e => setEv(d => ({ ...d, description: e.target.value }))} placeholder="Descripción del evento..."/></div>
            </div>
          )}

          {/* ═══ STEP 3: ZONES ═══ */}
          {step === 3 && (
            <div className="space-y-4">
              {zones.map((z, i) => (
                <div key={i} className="bg-[#141414] rounded-xl p-4 border border-[#282828] relative">
                  {zones.length > 1 && <XBtn onClick={() => setZones(zs => zs.filter((_, j) => j !== i))}/>}
                  <p className="text-xs text-gray-500 font-medium mb-3">Zona {i + 1}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lblCls}>Nombre *</label><input className={inpCls} value={z.zone_name} onChange={e => setZones(zs => zs.map((zz, j) => j === i ? { ...zz, zone_name: e.target.value } : zz))} placeholder="VIP, General..."/></div>
                    <div><label className={lblCls}>Tipo</label><select className={inpCls} value={z.zone_type} onChange={e => setZones(zs => zs.map((zz, j) => j === i ? { ...zz, zone_type: e.target.value } : zz))}>{ZONE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
                    <div><label className={lblCls}>Precio (MXN) *</label><input type="number" className={inpCls} value={z.price} min={0} onChange={e => setZones(zs => zs.map((zz, j) => j === i ? { ...zz, price: Number(e.target.value) } : zz))}/></div>
                    <div><label className={lblCls}>Capacidad *</label><input type="number" className={inpCls} value={z.total_capacity} min={1} onChange={e => setZones(zs => zs.map((zz, j) => j === i ? { ...zz, total_capacity: Number(e.target.value) } : zz))}/></div>
                  </div>
                </div>
              ))}
              <button onClick={() => setZones(zs => [...zs, { zone_name: '', zone_type: 'general', price: 0, total_capacity: 100 }])} className="w-full py-2.5 rounded-lg border border-dashed border-[#333] text-sm text-gray-400 hover:text-white hover:border-[#555] transition-colors">+ Agregar zona</button>
            </div>
          )}

          {/* ═══ STEP 4: FUNCTIONS ═══ */}
          {step === 4 && (
            <div className="space-y-4">
              {funcs.map((f, i) => (
                <div key={i} className="bg-[#141414] rounded-xl p-4 border border-[#282828] relative">
                  {funcs.length > 1 && <XBtn onClick={() => setFuncs(fs => fs.filter((_, j) => j !== i))}/>}
                  <p className="text-xs text-gray-500 font-medium mb-3">Función {i + 1} <span className="text-gray-600">· PIN: {f.staff_pin}</span></p>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div><label className={lblCls}>Fecha *</label><input type="date" className={inpCls} value={f.date} onChange={e => setFuncs(fs => fs.map((ff, j) => j === i ? { ...ff, date: e.target.value } : ff))}/></div>
                    <div><label className={lblCls}>Hora inicio *</label><input type="time" className={inpCls} value={f.start_time} onChange={e => setFuncs(fs => fs.map((ff, j) => j === i ? { ...ff, start_time: e.target.value } : ff))}/></div>
                    <div><label className={lblCls}>Hora fin</label><input type="time" className={inpCls} value={f.end_time} onChange={e => setFuncs(fs => fs.map((ff, j) => j === i ? { ...ff, end_time: e.target.value } : ff))}/></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={lblCls}>Capacidad</label><input type="number" className={inpCls} value={f.total_capacity} min={1} onChange={e => setFuncs(fs => fs.map((ff, j) => j === i ? { ...ff, total_capacity: Number(e.target.value) } : ff))}/></div>
                    <div><label className={lblCls}>Tel. staff</label><input className={inpCls} value={f.staff_phone} placeholder="55 1234 5678" onChange={e => setFuncs(fs => fs.map((ff, j) => j === i ? { ...ff, staff_phone: e.target.value } : ff))}/></div>
                    <div><label className={lblCls}>Email staff</label><input type="email" className={inpCls} value={f.staff_email} placeholder="staff@event.com" onChange={e => setFuncs(fs => fs.map((ff, j) => j === i ? { ...ff, staff_email: e.target.value } : ff))}/></div>
                  </div>
                </div>
              ))}
              <button onClick={() => setFuncs(fs => [...fs, { date: '', start_time: '20:00', end_time: '22:00', total_capacity: selVenue?.capacity || 200, staff_pin: rPin(), staff_phone: '', staff_email: '' }])} className="w-full py-2.5 rounded-lg border border-dashed border-[#333] text-sm text-gray-400 hover:text-white hover:border-[#555] transition-colors">+ Agregar función</button>
            </div>
          )}

          {/* ═══ STEP 5: REVIEW ═══ */}
          {step === 5 && (
            <div className="space-y-4">
              {/* Venue summary */}
              <div className="bg-[#141414] rounded-xl p-4 border border-[#282828]">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Venue</p>
                <p className="text-sm font-bold text-white">{selVenue?.name || '—'}</p>
                <p className="text-xs text-gray-400">{selVenue?.address} · {selVenue?.city} · Cap: {selVenue?.capacity}</p>
                {createNew && <span className="text-[10px] bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded-full mt-1 inline-block">Nuevo</span>}
              </div>

              {/* Event summary */}
              <div className="bg-[#141414] rounded-xl p-4 border border-[#282828]">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Evento</p>
                <p className="text-sm font-bold text-white">{ev.name}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                  <span>/{ev.slug}</span>
                  <span>{ev.event_type}</span>
                  <span>{ev.category}</span>
                  <span>{ev.start_date} → {ev.end_date}</span>
                  {ev.price_from > 0 && <span>Desde {fmt(ev.price_from)}</span>}
                </div>
                {ev.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{ev.description}</p>}
              </div>

              {/* Zones summary */}
              <div className="bg-[#141414] rounded-xl p-4 border border-[#282828]">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Zonas ({zones.length})</p>
                <div className="space-y-1">
                  {zones.map((z, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-white">{z.zone_name} <span className="text-gray-500">({z.zone_type})</span></span>
                      <span className="text-gray-400">{fmt(z.price)} · {z.total_capacity} lugares</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Functions summary */}
              <div className="bg-[#141414] rounded-xl p-4 border border-[#282828]">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Funciones ({funcs.length})</p>
                <div className="space-y-1">
                  {funcs.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-white">{f.date} {f.start_time}–{f.end_time}</span>
                      <span className="text-gray-400">Cap: {f.total_capacity} · PIN: {f.staff_pin}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inventory preview */}
              <div className="bg-[#141414] rounded-xl p-4 border border-[#282828]">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Inventario a crear</p>
                <p className="text-xs text-gray-400">{funcs.length} funciones × {zones.length} zonas = <span className="text-white font-bold">{funcs.length * zones.length}</span> registros de inventario</p>
              </div>

              {/* Commission */}
              <div className="bg-[#141414] rounded-xl p-4 border border-[#282828]">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Comisión</p>
                <div className="flex items-center gap-3">
                  <input type="number" className={`${inpCls} w-28`} value={commRate} step={0.01} min={0} max={1} onChange={e => setCommRate(Number(e.target.value))}/>
                  <span className="text-sm text-gray-400">= {(commRate * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-sm text-red-300">{error}</div>}

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#222]">
            <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="px-5 py-2.5 rounded-lg border border-[#333] text-gray-300 text-sm font-medium hover:bg-[#1a1a1a] transition-colors">
              {step === 1 ? 'Cancelar' : '← Anterior'}
            </button>
            {step < 5 ? (
              <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Siguiente →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                {submitting && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {submitting ? 'Creando...' : 'Crear Evento'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}