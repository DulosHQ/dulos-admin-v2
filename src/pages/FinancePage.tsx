'use client';

import React, { useState, useEffect } from 'react';
import FinanceScorecard from '../components/FinanceScorecard';
import CapacityBars from '../components/CapacityBars';
import SalesTrend from '../components/SalesTrend';
import {
  fetchZones,
  fetchAllOrders,
  fetchSchedules,
  fetchAllEvents,
  fetchTickets,
  DulosEvent,
  TicketZone,
  Ticket,
} from '../lib/supabase';

type TabKey = 'ingresos' | 'capacidad' | 'transacciones';

interface ScorecardData {
  revenue: number; revenuePrevious: number;
  aov: number; aovPrevious: number;
  completedOrders: number; completedOrdersPrevious: number;
  occupancyPercent: number; occupancyPercentPrevious: number;
}

interface ScheduleDisplay { name: string; date: string; capacity: number; sold: number; percentage: number; }
interface DailyData { date: string; amount: number; }
interface ZoneRevenue { zone: string; revenue: number; change: number; }
interface EventRevenue { id: string; name: string; image: string; revenue: number; tickets: number; zones: number; }

const tabs: { key: TabKey; label: string }[] = [
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'transacciones', label: 'Transacciones' },
  { key: 'capacidad', label: 'Capacidad' },
];

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);
}

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ingresos');
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState('');
  const [events, setEvents] = useState<DulosEvent[]>([]);
  const [zones, setZones] = useState<TicketZone[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [scorecardData, setScorecardData] = useState<ScorecardData>({ revenue: 0, revenuePrevious: 1, aov: 0, aovPrevious: 1, completedOrders: 0, completedOrdersPrevious: 1, occupancyPercent: 0, occupancyPercentPrevious: 1 });
  const [schedules, setSchedules] = useState<ScheduleDisplay[]>([]);
  const [eventRevenues, setEventRevenues] = useState<EventRevenue[]>([]);
  const [capacityStats, setCapacityStats] = useState({ critical: 0, high: 0, normal: 0, totalCapacity: 0 });

  useEffect(() => {
    async function loadData() {
      try {
        const [z, o, s, e, t] = await Promise.all([
          fetchZones().catch(() => []), fetchAllOrders().catch(() => []),
          fetchSchedules().catch(() => []), fetchAllEvents().catch(() => []),
          fetchTickets().catch(() => []),
        ]);
        setEvents(e); setZones(z); setTickets(t);
        const eventMap = new Map(e.map((ev) => [ev.id, ev]));

        // Revenue by event
        const revByEvent = new Map<string, { revenue: number; tickets: number; zones: Set<string> }>();
        z.forEach(zone => {
          const curr = revByEvent.get(zone.event_id) || { revenue: 0, tickets: 0, zones: new Set<string>() };
          curr.revenue += zone.sold * zone.price;
          curr.tickets += zone.sold;
          curr.zones.add(zone.zone_name);
          revByEvent.set(zone.event_id, curr);
        });

        const evRevArr: EventRevenue[] = Array.from(revByEvent.entries()).map(([id, d]) => ({
          id, name: eventMap.get(id)?.name || id, image: eventMap.get(id)?.image_url || '',
          revenue: d.revenue, tickets: d.tickets, zones: d.zones.size,
        })).sort((a, b) => b.revenue - a.revenue);
        setEventRevenues(evRevArr);

        // Totals
        const totalRevenue = z.reduce((s, zn) => s + (zn.sold * zn.price), 0);
        const totalSold = z.reduce((s, zn) => s + zn.sold, 0);
        const totalAvail = z.reduce((s, zn) => s + zn.available + zn.sold, 0);
        const occ = totalAvail > 0 ? (totalSold / totalAvail) * 100 : 0;
        const aov = totalSold > 0 ? totalRevenue / totalSold : 0;

        setScorecardData({ revenue: totalRevenue, revenuePrevious: totalRevenue || 1, aov, aovPrevious: aov || 1, completedOrders: totalSold, completedOrdersPrevious: totalSold || 1, occupancyPercent: occ, occupancyPercentPrevious: occ || 1 });

        // Schedules
        const sDisp = s.map(sc => {
          const ev = eventMap.get(sc.event_id);
          const cap = sc.total_capacity || 0;
          const sold = sc.sold_capacity || 0;
          return { name: ev?.name || sc.event_id, date: `${sc.date}T${sc.start_time}`, capacity: cap, sold, percentage: cap > 0 ? (sold / cap) * 100 : 0 };
        }).sort((a, b) => b.percentage - a.percentage);
        setSchedules(sDisp);
        setCapacityStats({ critical: sDisp.filter(s => s.percentage > 80).length, high: sDisp.filter(s => s.percentage >= 50 && s.percentage <= 80).length, normal: sDisp.filter(s => s.percentage < 50).length, totalCapacity: sDisp.reduce((s, sc) => s + sc.capacity, 0) });

        setLoading(false);
      } catch (err) { console.error(err); setLoading(false); }
    }
    loadData();
  }, []);

  // Filtered data
  const fZones = filterEvent ? zones.filter(z => z.event_id === filterEvent) : zones;
  const fTickets = filterEvent ? tickets.filter(t => t.event_id === filterEvent) : tickets;
  const fRevenue = fZones.reduce((s, z) => s + z.sold * z.price, 0);
  const fSold = fZones.reduce((s, z) => s + z.sold, 0);

  const exportCSV = () => {
    const rows = [['Ticket', 'Cliente', 'Email', 'Evento', 'Zona', 'Estado', 'Fecha'],
      ...fTickets.map(t => [t.ticket_number, t.customer_name, t.customer_email, t.event_id, t.zone_name, t.status, t.created_at])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'transacciones_dulos.csv'; a.click();
  };

  if (loading) return <div className="space-y-4"><div className="h-20 bg-gray-100 rounded-lg animate-pulse" /><div className="h-40 bg-gray-100 rounded-lg animate-pulse" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900">Panel Financiero</h1>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">Ingresos, transacciones y capacidad</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium">
            <option value="">Todos los eventos</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button onClick={exportCSV} className="px-3 py-1.5 bg-[#E63946] text-white rounded-lg text-xs font-bold hover:bg-[#c5303c] transition-colors">Exportar CSV</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === tab.key ? 'text-[#E63946] border-[#E63946]' : 'text-gray-500 border-transparent hover:text-gray-900'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'ingresos' && (
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ingresos Totales</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{formatMXN(filterEvent ? fRevenue : scorecardData.revenue)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Boletos Vendidos</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{filterEvent ? fSold : scorecardData.completedOrders}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ticket Promedio</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{formatMXN(filterEvent && fSold > 0 ? fRevenue / fSold : scorecardData.aov)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ocupacion</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{filterEvent ? `${fZones.length > 0 ? Math.round(fZones.reduce((s,z)=>s+z.sold,0) / fZones.reduce((s,z)=>s+z.sold+z.available,0) * 100) : 0}%` : `${scorecardData.occupancyPercent.toFixed(0)}%`}</p>
            </div>
          </div>

          {/* Revenue by Event */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100">
              <h3 className="text-sm font-extrabold text-gray-900">Revenue por Evento</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {eventRevenues.map(er => (
                <div key={er.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
                  {er.image ? (
                    <img src={er.image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{er.name}</p>
                    <p className="text-xs text-gray-500 font-medium">{er.tickets} boletos · {er.zones} zonas</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-gray-900 text-sm">{formatMXN(er.revenue)}</p>
                    <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-1">
                      <div className="h-full rounded-full bg-[#E63946]" style={{ width: `${eventRevenues[0]?.revenue ? (er.revenue / eventRevenues[0].revenue) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Zone Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100">
              <h3 className="text-sm font-extrabold text-gray-900">Desglose por Zona</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-3 font-bold text-gray-600 text-xs">Zona</th>
                  <th className="text-left py-2 px-3 font-bold text-gray-600 text-xs">Evento</th>
                  <th className="text-right py-2 px-3 font-bold text-gray-600 text-xs">Precio</th>
                  <th className="text-right py-2 px-3 font-bold text-gray-600 text-xs">Vendidos</th>
                  <th className="text-right py-2 px-3 font-bold text-gray-600 text-xs">Disponibles</th>
                  <th className="text-right py-2 px-3 font-bold text-gray-600 text-xs">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {fZones.map((z, i) => {
                  const ev = events.find(e => e.id === z.event_id);
                  return (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="py-1.5 px-3 font-bold text-gray-900">{z.zone_name}</td>
                      <td className="py-1.5 px-3 text-gray-600 font-medium">{ev?.name || z.event_id}</td>
                      <td className="py-1.5 px-3 text-right font-medium">{formatMXN(z.price)}</td>
                      <td className="py-1.5 px-3 text-right font-bold">{z.sold}</td>
                      <td className="py-1.5 px-3 text-right text-gray-500">{z.available}</td>
                      <td className="py-1.5 px-3 text-right font-black text-[#E63946]">{formatMXN(z.sold * z.price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'transacciones' && (
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-gray-900">Transacciones ({fTickets.length} boletos)</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 font-bold text-gray-600">Ticket</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-600">Cliente</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-600">Email</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-600">Evento</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-600">Zona</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-600">Estado</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-600">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {fTickets.map(t => {
                    const ev = events.find(e => e.id === t.event_id);
                    return (
                      <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="py-1.5 px-3 font-mono text-[#E63946] font-bold">{t.ticket_number}</td>
                        <td className="py-1.5 px-3 font-bold text-gray-900">{t.customer_name || '—'}</td>
                        <td className="py-1.5 px-3 text-gray-500">{t.customer_email || '—'}</td>
                        <td className="py-1.5 px-3 font-medium text-gray-700">{ev?.name || t.event_id}</td>
                        <td className="py-1.5 px-3 text-gray-600">{t.zone_name}</td>
                        <td className="py-1.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.status === 'valid' ? 'bg-green-50 text-green-700' : t.status === 'used' ? 'bg-blue-50 text-blue-700' : t.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {t.status === 'valid' ? 'VALIDO' : t.status === 'used' ? 'USADO' : t.status === 'cancelled' ? 'CANCELADO' : t.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-gray-500 tabular-nums">{new Date(t.created_at).toLocaleDateString('es-MX')}</td>
                      </tr>
                    );
                  })}
                  {fTickets.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-400 font-medium">Sin transacciones</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'capacidad' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Criticos</p>
              <p className="text-2xl font-black text-red-500 mt-1">{capacityStats.critical}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Alta</p>
              <p className="text-2xl font-black text-amber-500 mt-1">{capacityStats.high}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Normal</p>
              <p className="text-2xl font-black text-emerald-500 mt-1">{capacityStats.normal}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Capacidad Total</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{capacityStats.totalCapacity.toLocaleString()}</p>
            </div>
          </div>
          <CapacityBars schedules={schedules} />
        </div>
      )}
    </div>
  );
}
