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
import EventWizard from './EventWizard';

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
  isPast: boolean;
  schedules: ScheduleRow[];
  slug?: string;
  description?: string;
}
interface ScheduleRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
}
interface ZoneRow {
  zone_id: string;
  zone_name: string;
  zone_type: string;
  price: number;
  total_capacity: number;
}
interface OrderRow {
  order_number: string;
  customer_name: string;
  customer_email: string;
  zone: string;
  quantity: number;
  total_price: number;
  payment_status: string;
  purchased_at: string;
  schedule_id?: string | null;
}
type StatusFilter = 'all' | 'active' | 'completed' | 'past';
type EventTab = 'info' | 'funciones' | 'zonas' | 'compradores';

/* ─── Helpers ─── */
const fmtDate = (d: string) => { if (!d) return '—'; try { const dt = new Date(d); return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; } };
const fmtTime = (t: string) => t ? t.slice(0, 5) : '';
const fmtDateTime = (d: string) => { if (!d) return '—'; try { const dt = new Date(d); return isNaN(dt.getTime()) ? '—' : dt.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; } };
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);

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

/* ─── Event Detail Tabs ─── */
function EventDetail({ event: ev, onBack, zones, orders }: { event: EventCard; onBack: () => void; zones: TicketZone[]; orders: Order[] }) {
  const [activeTab, setActiveTab] = useState<EventTab>('info');

  // Get zones for this event
  const eventZones = zones.filter(z => z.event_id === ev.id);
  
  // Get orders for this event (completed/paid only)
  const eventOrders: OrderRow[] = orders
    .filter(o => o.event_id === ev.id && (o.payment_status === 'completed' || o.payment_status === 'paid'))
    .map(o => ({
      order_number: o.order_number || 'N/A',
      customer_name: o.customer_name || 'N/A',
      customer_email: o.customer_email || 'N/A', 
      zone: o.zone_name || 'N/A',
      quantity: o.quantity || 0,
      total_price: o.total_price || 0,
      payment_status: o.payment_status || 'pending',
      purchased_at: o.purchased_at || '',
      schedule_id: o.schedule_id
    }))
    .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime());

  const nextFunction = ev.schedules.length > 0 
    ? ev.schedules.find(s => new Date(s.date) >= new Date()) 
    : null;

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        Volver a eventos
      </button>

      {/* Header */}
      <div className="bg-[#111] rounded-xl p-4 mb-4 flex flex-col sm:flex-row gap-4">
        {ev.image_url ? <img src={ev.image_url} alt={ev.name} className="w-full sm:w-40 h-32 sm:h-28 rounded-lg object-cover flex-shrink-0"/> : <div className="w-full sm:w-40 h-32 sm:h-28 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-3xl flex-shrink-0">?</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-lg font-bold text-white truncate">{ev.name}</h2>
            <Badge status={ev.status} isPast={ev.isPast}/>
          </div>
          <p className="text-sm text-gray-400">{ev.venueName}{ev.venueCity ? `, ${ev.venueCity}` : ''}</p>
          <div className="flex flex-wrap gap-4 mt-3 text-sm">
            <div><span className="text-gray-500">Tipo</span><p className="text-white font-medium">{ev.event_type === 'single' ? 'Único' : ev.event_type === 'recurring' ? 'Recurrente' : 'Múltiple'}</p></div>
            <div><span className="text-gray-500">Funciones</span><p className="text-white font-medium">{ev.schedules.length}</p></div>
            {nextFunction && <div><span className="text-gray-500">Próxima función</span><p className="text-white font-medium">{fmtDate(nextFunction.date)}</p></div>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[#111] p-1 w-fit mb-4">
        {([
          {k:'info' as EventTab, l:'Info'},
          {k:'funciones' as EventTab, l:'Funciones'},
          {k:'zonas' as EventTab, l:'Zonas y Precios'},
          {k:'compradores' as EventTab, l:'Compradores'}
        ]).map(t => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${activeTab===t.k?'bg-[#EF4444] text-white':'text-gray-400 hover:text-white'}`}>{t.l}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[#111] rounded-xl p-4">
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Información Básica</h3>
              <div className="space-y-3">
                <div><span className="text-gray-500 text-sm">Nombre:</span> <span className="text-white">{ev.name}</span></div>
                <div><span className="text-gray-500 text-sm">Venue:</span> <span className="text-white">{ev.venueName}</span></div>
                <div><span className="text-gray-500 text-sm">Ciudad:</span> <span className="text-white">{ev.venueCity || 'N/A'}</span></div>
                <div><span className="text-gray-500 text-sm">Slug:</span> <span className="text-white">{ev.slug || 'N/A'}</span></div>
                <div><span className="text-gray-500 text-sm">Estado:</span> <Badge status={ev.status} isPast={ev.isPast}/></div>
                <div><span className="text-gray-500 text-sm">Tipo de evento:</span> <span className="text-white">{ev.event_type === 'single' ? 'Evento único' : ev.event_type === 'recurring' ? 'Recurrente' : 'Múltiple'}</span></div>
                {ev.description && <div><span className="text-gray-500 text-sm">Descripción:</span> <p className="text-white mt-1">{ev.description}</p></div>}
                {ev.slug && <div><span className="text-gray-500 text-sm">Página pública:</span> <a href={`https://dulos.io/evento/${ev.slug}`} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 underline">dulos.io/evento/{ev.slug}</a></div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'funciones' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Funciones Programadas</h3>
            {ev.schedules.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No hay funciones programadas</div>
            ) : (
              <div className="space-y-2">
                {ev.schedules.map(s => (
                  <div key={s.id} className="border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">{fmtDate(s.date)}</p>
                        <p className="text-sm text-gray-400">{fmtTime(s.start_time)}{s.end_time ? ` — ${fmtTime(s.end_time)}` : ''}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'active' ? 'bg-green-900/50 text-green-400' : s.status === 'cancelled' ? 'bg-red-900/50 text-red-400' : 'bg-gray-700 text-gray-300'}`}>
                          {s.status === 'active' ? 'Activa' : s.status === 'cancelled' ? 'Cancelada' : 'Cerrada'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'zonas' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Zonas y Precios</h3>
            {eventZones.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No hay zonas configuradas</div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900/50">
                    <tr className="text-gray-400">
                      <th className="text-left px-4 py-3">Zona</th>
                      <th className="text-center px-4 py-3">Tipo</th>
                      <th className="text-right px-4 py-3">Precio</th>
                      <th className="text-right px-4 py-3">Capacidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventZones.map((z, i) => (
                      <tr key={i} className="border-t border-gray-800/50">
                        <td className="px-4 py-3 text-white font-medium">{z.zone_name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${(z.zone_type === 'general' || z.zone_type === 'ga') ? 'bg-green-900/40 text-green-400' : 'bg-orange-900/40 text-orange-400'}`}>
                            {(z.zone_type === 'general' || z.zone_type === 'ga') ? 'GA' : 'RES'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-white font-medium">{fmt(z.price || 0)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{((z.available || 0) + (z.sold || 0)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'compradores' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Compradores</h3>
            {eventOrders.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No hay órdenes registradas</div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-900/50">
                      <tr className="text-gray-400">
                        <th className="text-left px-3 py-3 whitespace-nowrap">Orden</th>
                        <th className="text-left px-3 py-3 whitespace-nowrap">Cliente</th>
                        <th className="text-left px-3 py-3 whitespace-nowrap">Email</th>
                        <th className="text-left px-3 py-3 whitespace-nowrap">Zona</th>
                        <th className="text-right px-3 py-3 whitespace-nowrap">Qty</th>
                        <th className="text-right px-3 py-3 whitespace-nowrap">Total</th>
                        <th className="text-center px-3 py-3 whitespace-nowrap">Estado</th>
                        <th className="text-left px-3 py-3 whitespace-nowrap">Compra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventOrders.slice(0, 50).map((o, i) => (
                        <tr key={i} className="border-t border-gray-800/50">
                          <td className="px-3 py-2 text-white font-medium">{o.order_number}</td>
                          <td className="px-3 py-2 text-white">{o.customer_name}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{o.customer_email}</td>
                          <td className="px-3 py-2 text-gray-400">{o.zone}</td>
                          <td className="px-3 py-2 text-right text-white">{o.quantity}</td>
                          <td className="px-3 py-2 text-right text-white font-medium">{fmt(o.total_price)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs px-2 py-1 rounded-full ${o.payment_status === 'completed' ? 'bg-green-900/50 text-green-400' : o.payment_status === 'paid' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                              {o.payment_status === 'completed' || o.payment_status === 'paid' ? 'Pagada' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{fmtDateTime(o.purchased_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {eventOrders.length > 50 && (
                  <div className="px-4 py-2 bg-gray-900/30 text-xs text-gray-500 text-center">
                    Mostrando las primeras 50 órdenes de {eventOrders.length} totales
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
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
  const [wizardOpen, setWizardOpen] = useState(false);

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

  // Removed financial calculations - this is now a management-only view

  const cards: EventCard[] = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return events.map(evt => {
      const eSch = schedules.filter(s => s.event_id === evt.id);
      const isPast = eSch.length > 0 ? eSch.every(s => { const d = new Date(s.date); d.setHours(0,0,0,0); return d < today; }) : evt.start_date ? new Date(evt.start_date) < today : false;
      
      const rows: ScheduleRow[] = eSch.sort((a,b) => (a.date||'').localeCompare(b.date||'')||(a.start_time||'').localeCompare(b.start_time||'')).map(sc => ({
        id: sc.id, 
        date: sc.date, 
        start_time: sc.start_time, 
        end_time: sc.end_time, 
        status: sc.status
      }));

      return { 
        id: evt.id, 
        name: evt.name, 
        status: isPast&&evt.status==='active'?'completed':evt.status, 
        image_url: evt.image_url||'', 
        event_type: evt.event_type||'single', 
        start_date: evt.start_date, 
        venue_id: evt.venue_id, 
        venueName: getVenueName(evt.venue_id, venueMap), 
        venueCity: getVenueCity(evt.venue_id, venueMap),
        isPast, 
        schedules: rows,
        slug: evt.slug,
        description: evt.description
      };
    });
  }, [events, schedules, venueMap]);

  const cities = useMemo(() => { const s = new Set<string>(); cards.forEach(e => { if(e.venueCity) s.add(e.venueCity); }); return [...s].sort(); }, [cards]);

  const filtered = useMemo(() => cards
    .filter(e => { if(statusF==='active') return e.status==='active'&&!e.isPast; if(statusF==='completed') return e.status==='completed'||e.status==='archived'; if(statusF==='past') return e.isPast; return true; })
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
    .filter(e => !cityF || e.venueCity===cityF)
    .sort((a,b) => { if(a.isPast!==b.isPast) return a.isPast?1:-1; return (b.start_date||'').localeCompare(a.start_date||''); })
  , [cards, statusF, search, cityF]);

  const selEv = selId ? cards.find(e => e.id === selId) || null : null;

  if (loading) return (<div className="bg-[#0a0a0a] min-h-[600px] rounded-2xl p-4 sm:p-6"><h1 className="text-xl font-bold text-white mb-6">EVENTOS</h1><Skel/></div>);

  if (selEv) return (<div className="bg-[#0a0a0a] min-h-[600px] rounded-2xl p-4 sm:p-6"><EventDetail event={selEv} onBack={() => setSelId(null)} zones={zones} orders={orders}/></div>);

  return (
    <div className="bg-[#0a0a0a] min-h-[600px] rounded-2xl p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">EVENTOS</h1>
          <button onClick={() => setWizardOpen(true)} className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Crear Evento
          </button>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input type="text" placeholder="Buscar evento..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[140px] rounded-lg border border-gray-700 bg-[#111] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"/>
          {cities.length > 1 && <select value={cityF} onChange={e => setCityF(e.target.value)} className="rounded-lg border border-gray-700 bg-[#111] px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"><option value="">Todas las ciudades</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select>}
        </div>
      </div>
      <div className="flex gap-1 rounded-lg bg-[#111] p-1 w-fit mb-4">
        {([{k:'all' as StatusFilter,l:'Todos'},{k:'active' as StatusFilter,l:'Activos'},{k:'completed' as StatusFilter,l:'Finalizados'},{k:'past' as StatusFilter,l:'Pasados'}]).map(t => (
          <button key={t.k} onClick={() => setStatusF(t.k)} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${statusF===t.k?'bg-[#EF4444] text-white':'text-gray-400 hover:text-white'}`}>{t.l}</button>
        ))}
      </div>
      {/* Removed financial KPI cards - now lives in Vista General and Finanzas */}
      <div className="space-y-2">
        {filtered.map(evt => {
          const nextFunction = evt.schedules.length > 0 
            ? evt.schedules.find(s => new Date(s.date) >= new Date()) 
            : null;
          
          return (
            <div key={evt.id} onClick={() => setSelId(evt.id)} className="bg-[#111] rounded-xl p-3 sm:p-4 flex gap-3 sm:gap-4 cursor-pointer hover:bg-[#181818] transition-colors group">
              {evt.image_url ? <img src={evt.image_url} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0"/> : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-xl flex-shrink-0">?</div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <h3 className="text-sm sm:text-base font-semibold text-white truncate">{evt.name}</h3>
                  <Badge status={evt.status} isPast={evt.isPast}/>
                </div>
                <p className="text-xs text-gray-500 truncate">{evt.venueName}{evt.venueCity ? `, ${evt.venueCity}` : ''}</p>
                <div className="flex flex-wrap gap-3 sm:gap-4 mt-2 text-xs">
                  {nextFunction && <span className="text-gray-400">Próxima: <span className="text-white font-medium">{fmtDate(nextFunction.date)}</span></span>}
                  <span className="text-gray-400">Funciones: <span className="text-white font-medium">{evt.schedules.length}</span></span>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0 self-center" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <div className="bg-[#111] rounded-xl p-8 text-center text-gray-500">No hay eventos con estos filtros</div>}
      <EventWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreated={() => { toast.success('Evento creado exitosamente'); load(); }}/>
    </div>
  );
}
