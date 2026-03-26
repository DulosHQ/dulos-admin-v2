'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  fetchAllEvents,
  fetchZones,
  fetchAllOrders,
  fetchSchedules,
  fetchScheduleInventory,
  getVenueMap,
  getVenueName,
  getVenueCity,
  DulosEvent,
  TicketZone,
  Order,
  Schedule,
  ScheduleInventory,
  Venue,
} from '../lib/supabase';

/* ─── Types ─── */
interface EventCard {
  id: string;
  name: string;
  status: string;
  image_url: string;
  event_type: string;
  start_date: string;
  venue_id: string;
  venueName: string;
  venueCity: string;
  totalSold: number;
  totalCapacity: number;
  revenue: number;
  occupancyPct: number;
  isPast: boolean;
  schedules: ScheduleRow[];
}
interface ScheduleRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  sold: number;
  capacity: number;
  occupancyPct: number;
  revenue: number;
  zones: ZoneRow[];
}
interface ZoneRow {
  zone_id: string;
  zone_name: string;
  zone_type: string;
  price: number;
  sold: number;
  capacity: number;
  occupancyPct: number;
}
type StatusFilter = 'all' | 'active' | 'completed' | 'past';

/* ─── Helpers ─── */
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => { if (!d) return '—'; try { const dt = new Date(d); return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; } };
const fmtTime = (t: string) => t ? t.slice(0, 5) : '';

function Sem({ pct, sm }: { pct: number; sm?: boolean }) {
  const c = pct >= 70 ? 'bg-green-500' : pct >= 30 ? 'bg-yellow-500' : 'bg-red-500';
  return <span className={`inline-block rounded-full flex-shrink-0 ${sm ? 'w-2.5 h-2.5' : 'w-3 h-3'} ${c}`} title={`${pct.toFixed(1)}%`} />;
}
function SemEmoji({ pct }: { pct: number }) { return <span title={`${pct.toFixed(1)}%`}>{pct >= 70 ? '🟢' : pct >= 30 ? '🟡' : '🔴'}</span>; }
function Badge({ status, isPast }: { status: string; isPast: boolean }) {
  if (isPast) return <span className="text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">Pasado</span>;
  if (status === 'active') return <span className="text-[10px] bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">Activo</span>;
  if (status === 'draft') return <span className="text-[10px] bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded-full">Borrador</span>;
  return <span className="text-[10px] bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full">Finalizado</span>;
}

/* ─── Skeleton ─── */
function Skel() {
  return (<div className="space-y-3 animate-pulse">{[1,2,3,4].map(i=><div key={i} className="bg-[#111] rounded-xl p-4 flex gap-4"><div className="w-20 h-20 rounded-lg bg-gray-800 flex-shrink-0"/><div className="flex-1 space-y-2"><div className="h-4 bg-gray-800 rounded w-1/3"/><div className="h-3 bg-gray-800 rounded w-1/4"/><div className="h-3 bg-gray-800 rounded w-1/2"/></div></div>)}</div>);
}

/* ─── Drill-down view ─── */
function DrillDown({ event: ev, onBack }: { event: EventCard; onBack: () => void }) {
  const [expId, setExpId] = useState<string | null>(null);
  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        Volver a eventos
      </button>
      <div className="bg-[#111] rounded-xl p-4 mb-4 flex flex-col sm:flex-row gap-4">
        {ev.image_url ? <img src={ev.image_url} alt={ev.name} className="w-full sm:w-40 h-32 sm:h-28 rounded-lg object-cover flex-shrink-0"/> : <div className="w-full sm:w-40 h-32 sm:h-28 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-3xl flex-shrink-0">?</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-lg font-bold text-white truncate">{ev.name}</h2>
            <SemEmoji pct={ev.occupancyPct}/>
            <Badge status={ev.status} isPast={ev.isPast}/>
          </div>
          <p className="text-sm text-gray-400">{ev.venueName}{ev.venueCity ? `, ${ev.venueCity}` : ''}</p>
          <div className="flex flex-wrap gap-4 mt-3 text-sm">
            <div><span className="text-gray-500">Vendidos</span><p className="text-white font-bold">{ev.totalSold.toLocaleString()} / {ev.totalCapacity.toLocaleString()}</p></div>
            <div><span className="text-gray-500">Ocupación</span><p className="text-white font-bold">{ev.occupancyPct.toFixed(1)}%</p></div>
            <div><span className="text-gray-500">Revenue</span><p className="text-white font-bold">{fmt(ev.revenue)}</p></div>
            <div><span className="text-gray-500">Funciones</span><p className="text-white font-bold">{ev.schedules.length}</p></div>
          </div>
        </div>
      </div>
      {ev.schedules.length === 0 ? (
        <div className="bg-[#111] rounded-xl p-8 text-center text-gray-500">Sin funciones registradas</div>
      ) : (
        <div className="space-y-2">{ev.schedules.map(s => {
          const exp = expId === s.id;
          return (
            <div key={s.id} className="bg-[#111] rounded-xl overflow-hidden">
              <div onClick={() => setExpId(exp ? null : s.id)} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#181818] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Sem pct={s.occupancyPct}/>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{fmtDate(s.date)}</p>
                    <p className="text-xs text-gray-500">{fmtTime(s.start_time)}{s.end_time ? ` — ${fmtTime(s.end_time)}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                  <div className="text-right hidden sm:block"><p className="text-xs text-gray-500">Revenue</p><p className="text-sm font-bold text-white">{fmt(s.revenue)}</p></div>
                  <div className="text-right"><p className="text-xs text-gray-500">Vendidos</p><p className="text-sm font-bold text-white">{s.sold}/{s.capacity}</p></div>
                  <div className="text-right min-w-[50px]"><p className="text-xs text-gray-500">Ocup.</p><p className={`text-sm font-bold ${s.occupancyPct >= 70 ? 'text-green-400' : s.occupancyPct >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>{s.occupancyPct.toFixed(0)}%</p></div>
                  <svg className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${exp ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </div>
              </div>
              {exp && s.zones.length > 0 && (
                <div className="border-t border-gray-800 px-4 py-3 animate-fade-in">
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-2 font-medium">Zona</th>
                      <th className="text-center pb-2 font-medium hidden sm:table-cell">Tipo</th>
                      <th className="text-right pb-2 font-medium hidden sm:table-cell">Precio</th>
                      <th className="text-right pb-2 font-medium">Vend.</th>
                      <th className="text-right pb-2 font-medium">Cap.</th>
                      <th className="text-right pb-2 font-medium">Ocup.</th>
                    </tr></thead>
                    <tbody>{s.zones.map(z => (
                      <tr key={z.zone_id} className="border-b border-gray-800/50 last:border-0">
                        <td className="py-2 text-white font-medium"><span className="flex items-center gap-2"><Sem pct={z.occupancyPct} sm/>{z.zone_name}</span></td>
                        <td className="py-2 text-center hidden sm:table-cell"><span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${z.zone_type === 'ga' ? 'bg-green-900/40 text-green-400' : 'bg-orange-900/40 text-orange-400'}`}>{z.zone_type === 'ga' ? 'GA' : 'NUM'}</span></td>
                        <td className="py-2 text-right text-gray-400 hidden sm:table-cell">{fmt(z.price)}</td>
                        <td className="py-2 text-right text-white">{z.sold}</td>
                        <td className="py-2 text-right text-gray-400">{z.capacity}</td>
                        <td className="py-2 text-right"><span className={`font-bold ${z.occupancyPct >= 70 ? 'text-green-400' : z.occupancyPct >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>{z.occupancyPct.toFixed(0)}%</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════ */
export default function EventsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<DulosEvent[]>([]);
  const [venueMap, setVenueMap] = useState<Map<string, Venue>>(new Map());
  const [zones, setZones] = useState<TicketZone[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [allInv, setAllInv] = useState<ScheduleInventory[]>([]);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState<StatusFilter>('all');
  const [cityF, setCityF] = useState('');
  const [selId, setSelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ev, zn, od, sc, vm, iv] = await Promise.all([
        fetchAllEvents().catch(() => [] as DulosEvent[]),
        fetchZones().catch(() => [] as TicketZone[]),
        fetchAllOrders().catch(() => [] as Order[]),
        fetchSchedules().catch(() => [] as Schedule[]),
        getVenueMap().catch(() => new Map<string, Venue>()),
        fetchScheduleInventory().catch(() => [] as ScheduleInventory[]),
      ]);
      setEvents(ev); setZones(zn); setOrders(od); setSchedules(sc); setVenueMap(vm); setAllInv(iv);
    } catch (e) { console.error(e); toast.error('Error cargando datos'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const zoneById = useMemo(() => { const m = new Map<string, TicketZone & {id:string}>(); zones.forEach(z => { const t = z as TicketZone & {id:string}; if(t.id) m.set(t.id, t); }); return m; }, [zones]);
  const revByEvent = useMemo(() => { const m = new Map<string, number>(); orders.forEach(o => { if(o.payment_status==='completed'||o.payment_status==='paid') m.set(o.event_id, (m.get(o.event_id)||0)+o.total_price); }); return m; }, [orders]);
  const revBySched = useMemo(() => { const m = new Map<string, number>(); orders.forEach(o => { if((o.payment_status==='completed'||o.payment_status==='paid')&&o.schedule_id) m.set(o.schedule_id, (m.get(o.schedule_id)||0)+o.total_price); }); return m; }, [orders]);
  const invBySched = useMemo(() => { const m = new Map<string, ScheduleInventory[]>(); allInv.forEach(i => { const a = m.get(i.schedule_id)||[]; a.push(i); m.set(i.schedule_id, a); }); return m; }, [allInv]);

  const cards: EventCard[] = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return events.map(evt => {
      const eSch = schedules.filter(s => s.event_id === evt.id);
      const eZon = zones.filter(z => z.event_id === evt.id);
      const isPast = eSch.length > 0 ? eSch.every(s => { const d = new Date(s.date); d.setHours(0,0,0,0); return d < today; }) : evt.start_date ? new Date(evt.start_date) < today : false;
      const rows: ScheduleRow[] = eSch.sort((a,b) => (a.date||'').localeCompare(b.date||'')||(a.start_time||'').localeCompare(b.start_time||'')).map(sc => {
        const inv = invBySched.get(sc.id) || [];
        const zr: ZoneRow[] = inv.map(si => { const tz = zoneById.get(si.zone_id); const cap = si.total_capacity||(si.sold+si.available)||0; const sold = si.sold||0; return { zone_id: si.zone_id, zone_name: tz?.zone_name||'Zona', zone_type: tz?.zone_type||'ga', price: tz?.price||0, sold, capacity: cap, occupancyPct: cap>0?(sold/cap)*100:0 }; });
        if(zr.length===0 && eZon.length>0) eZon.forEach(tz => { const cap = (tz.available||0)+(tz.sold||0); zr.push({ zone_id: (tz as TicketZone & {id:string}).id||'', zone_name: tz.zone_name, zone_type: tz.zone_type||'ga', price: tz.price, sold: tz.sold||0, capacity: cap, occupancyPct: cap>0?((tz.sold||0)/cap)*100:0 }); });
        const ts = zr.reduce((s,z)=>s+z.sold,0), tc = zr.reduce((s,z)=>s+z.capacity,0);
        return { id: sc.id, date: sc.date, start_time: sc.start_time, end_time: sc.end_time, status: sc.status, sold: ts, capacity: tc, occupancyPct: tc>0?(ts/tc)*100:0, revenue: revBySched.get(sc.id)||0, zones: zr };
      });
      const ts = rows.reduce((s,r)=>s+r.sold,0), tc = rows.reduce((s,r)=>s+r.capacity,0);
      const fSold = ts || eZon.reduce((s,z)=>s+(z.sold||0),0), fCap = tc || eZon.reduce((s,z)=>s+(z.available||0)+(z.sold||0),0);
      return { id: evt.id, name: evt.name, status: isPast&&evt.status==='active'?'completed':evt.status, image_url: evt.image_url||'', event_type: evt.event_type||'single', start_date: evt.start_date, venue_id: evt.venue_id, venueName: getVenueName(evt.venue_id, venueMap), venueCity: getVenueCity(evt.venue_id, venueMap), totalSold: fSold, totalCapacity: fCap, revenue: revByEvent.get(evt.id)||0, occupancyPct: fCap>0?(fSold/fCap)*100:0, isPast, schedules: rows };
    });
  }, [events, schedules, zones, venueMap, allInv, zoneById, invBySched, revByEvent, revBySched]);

  const cities = useMemo(() => { const s = new Set<string>(); cards.forEach(e => { if(e.venueCity) s.add(e.venueCity); }); return [...s].sort(); }, [cards]);

  const filtered = useMemo(() => cards
    .filter(e => { if(statusF==='active') return e.status==='active'&&!e.isPast; if(statusF==='completed') return e.status==='completed'||e.status==='archived'; if(statusF==='past') return e.isPast; return true; })
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
    .filter(e => !cityF || e.venueCity===cityF)
    .sort((a,b) => { if(a.isPast!==b.isPast) return a.isPast?1:-1; return (b.start_date||'').localeCompare(a.start_date||''); })
  , [cards, statusF, search, cityF]);

  const selEv = selId ? cards.find(e => e.id === selId) || null : null;

  if (loading) return (<div className="bg-[#0a0a0a] min-h-[600px] rounded-2xl p-4 sm:p-6"><h1 className="text-xl font-bold text-white mb-6">EVENTOS</h1><Skel/></div>);

  if (selEv) return (<div className="bg-[#0a0a0a] min-h-[600px] rounded-2xl p-4 sm:p-6"><DrillDown event={selEv} onBack={() => setSelId(null)}/></div>);

  const totSold = filtered.reduce((s,e)=>s+e.totalSold,0);
  const totCap = filtered.reduce((s,e)=>s+e.totalCapacity,0);
  const totRev = filtered.reduce((s,e)=>s+e.revenue,0);
  const avgOcc = totCap > 0 ? ((totSold/totCap)*100).toFixed(1)+'%' : '0%';

  return (
    <div className="bg-[#0a0a0a] min-h-[600px] rounded-2xl p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-xl font-bold text-white">EVENTOS</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <input type="text" placeholder="Buscar evento..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[140px] rounded-lg border border-gray-700 bg-[#111] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"/>
          {cities.length > 1 && <select value={cityF} onChange={e => setCityF(e.target.value)} className="rounded-lg border border-gray-700 bg-[#111] px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"><option value="">Todas las ciudades</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select>}
        </div>
      </div>
      <div className="flex gap-1 rounded-lg bg-[#111] p-1 w-fit mb-4">
        {([{k:'all' as StatusFilter,l:'Todos'},{k:'active' as StatusFilter,l:'Activos'},{k:'completed' as StatusFilter,l:'Finalizados'},{k:'past' as StatusFilter,l:'Pasados'}]).map(t => (
          <button key={t.k} onClick={() => setStatusF(t.k)} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${statusF===t.k?'bg-white text-black':'text-gray-400 hover:text-white'}`}>{t.l}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-[#111] rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Total Eventos</p><p className="text-lg font-bold text-white">{filtered.length}</p></div>
        <div className="bg-[#111] rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Boletos Vendidos</p><p className="text-lg font-bold text-white">{totSold.toLocaleString()}</p></div>
        <div className="bg-[#111] rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Revenue Total</p><p className="text-lg font-bold text-white">{fmt(totRev)}</p></div>
        <div className="bg-[#111] rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Ocup. Promedio</p><p className="text-lg font-bold text-white">{avgOcc}</p></div>
      </div>
      <div className="space-y-2">
        {filtered.map(evt => (
          <div key={evt.id} onClick={() => setSelId(evt.id)} className="bg-[#111] rounded-xl p-3 sm:p-4 flex gap-3 sm:gap-4 cursor-pointer hover:bg-[#181818] transition-colors group">
            {evt.image_url ? <img src={evt.image_url} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0"/> : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-xl flex-shrink-0">?</div>}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <SemEmoji pct={evt.occupancyPct}/>
                <h3 className="text-sm sm:text-base font-semibold text-white truncate">{evt.name}</h3>
                <Badge status={evt.status} isPast={evt.isPast}/>
              </div>
              <p className="text-xs text-gray-500 truncate">{evt.venueName}{evt.venueCity ? `, ${evt.venueCity}` : ''} · {fmtDate(evt.start_date)}</p>
              <div className="flex flex-wrap gap-3 sm:gap-4 mt-2 text-xs">
                <span className="text-gray-400">Vendidos: <span className="text-white font-bold">{evt.totalSold.toLocaleString()}/{evt.totalCapacity.toLocaleString()}</span></span>
                <span className="text-gray-400">Ocup: <span className={`font-bold ${evt.occupancyPct >= 70 ? 'text-green-400' : evt.occupancyPct >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>{evt.occupancyPct.toFixed(0)}%</span></span>
                <span className="text-gray-400">Revenue: <span className="text-white font-bold">{fmt(evt.revenue)}</span></span>
                {evt.schedules.length > 0 && <span className="text-gray-400">Funciones: <span className="text-white font-bold">{evt.schedules.length}</span></span>}
              </div>
              {/* Mini semaphore strip for functions */}
              {evt.schedules.length > 1 && (
                <div className="flex items-center gap-1 mt-2">
                  {evt.schedules.slice(0, 20).map(s => <Sem key={s.id} pct={s.occupancyPct} sm/>)}
                  {evt.schedules.length > 20 && <span className="text-[10px] text-gray-500">+{evt.schedules.length - 20}</span>}
                </div>
              )}
            </div>
            <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0 self-center" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div className="bg-[#111] rounded-xl p-8 text-center text-gray-500">No hay eventos con estos filtros</div>}
    </div>
  );
}
