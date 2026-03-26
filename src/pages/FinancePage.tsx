'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  fetchAllOrders,
  fetchAllEvents,
  fetchSchedules,
  fetchScheduleInventory,
  fetchDispersions,
  fetchEventCommissions,
  fetchZones,
  getVenueMap,
  getVenueName,
  getVenueCity,
  Order,
  DulosEvent,
  Schedule,
  ScheduleInventory,
  Dispersion,
  EventCommission,
  TicketZone,
} from '../lib/supabase';

type DateRange = '7d' | '30d' | '90d' | 'all';

interface EventFinanceData {
  id: string;
  name: string;
  venue_name: string;
  venue_city: string;
  tickets_sold: number;
  revenue: number;
  refunds_count: number;
  refunds_amount: number;
  commission_rate: number;
  commission_amount: number;
  net_producer: number;
  ad_spend: number;
  roas: number | null;
}

interface DrillDownData {
  zones: ZoneBreakdown[];
  schedules: ScheduleBreakdown[];
  salesTrend: SalesTrendPoint[];
}

interface ZoneBreakdown {
  zone: string;
  price: number;
  sold: number;
  revenue: number;
  percentage: number;
}

interface ScheduleZoneBreakdown {
  zone: string;
  sold: number;
  capacity: number;
  revenue: number;
}

interface ScheduleBreakdown {
  date: string;
  time: string;
  sold: number;
  capacity: number;
  occupancy: number;
  revenue: number;
  zones: ScheduleZoneBreakdown[];
}

interface SalesTrendPoint {
  date: string;
  revenue: number;
}

const fmtCurrency = (n: number) => new Intl.NumberFormat('es-MX', { 
  style: 'currency', 
  currency: 'MXN', 
  minimumFractionDigits: 0 
}).format(n);

const fmtDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', { 
      day: 'numeric', 
      month: 'short' 
    });
  } catch {
    return dateStr;
  }
};

const fmtTime = (timeStr: string) => {
  try {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
};

function SkeletonCard() {
  return (
    <div className="bg-[#111] rounded-xl p-4 animate-pulse">
      <div className="h-3 bg-gray-700 rounded w-2/3 mb-2"></div>
      <div className="h-6 bg-gray-700 rounded w-1/2"></div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-[#111] rounded-xl animate-pulse">
      <div className="p-4 border-b border-gray-800">
        <div className="h-4 bg-gray-700 rounded w-1/3"></div>
      </div>
      <div className="divide-y divide-gray-800">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 flex gap-4">
            <div className="h-4 bg-gray-700 rounded flex-1"></div>
            <div className="h-4 bg-gray-700 rounded w-20"></div>
            <div className="h-4 bg-gray-700 rounded w-24"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FinancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [drillDownEventId, setDrillDownEventId] = useState<string | null>(null);
  const [drillDownData, setDrillDownData] = useState<DrillDownData | null>(null);
  const [expandedSchedules, setExpandedSchedules] = useState<Set<number>>(new Set());
  
  // Raw data
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<DulosEvent[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [inventory, setInventory] = useState<ScheduleInventory[]>([]);
  const [dispersions, setDispersions] = useState<Dispersion[]>([]);
  const [commissions, setCommissions] = useState<EventCommission[]>([]);
  const [zones, setZones] = useState<TicketZone[]>([]);
  const [venueMap, setVenueMap] = useState<Map<string, any>>(new Map());

  // Load all data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        const [
          ordersData,
          eventsData,
          schedulesData,
          inventoryData,
          dispersionsData,
          commissionsData,
          zonesData,
          venueMapData,
        ] = await Promise.all([
          fetchAllOrders(),
          fetchAllEvents(),
          fetchSchedules(),
          fetchScheduleInventory(),
          fetchDispersions(),
          fetchEventCommissions(),
          fetchZones(),
          getVenueMap(),
        ]);

        setOrders(ordersData);
        setEvents(eventsData);
        setSchedules(schedulesData);
        setInventory(inventoryData);
        if (inventoryData.length === 0) console.warn('[Finanzas] schedule_inventory returned 0 rows — vendidos/capacidad will use fallback');
        setDispersions(dispersionsData);
        setCommissions(commissionsData);
        setZones(zonesData);
        setVenueMap(venueMapData);
      } catch (err) {
        console.error('Error loading finance data:', err);
        setError('Error cargando datos financieros');
        toast.error('Error cargando datos financieros');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    let startDate: Date | null = null;
    const now = new Date();

    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        return orders;
    }

    if (!startDate) return orders;

    return orders.filter(order => {
      const orderDate = new Date(order.purchased_at);
      return orderDate >= startDate;
    });
  }, [orders, dateRange]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const paidOrders = filteredOrders.filter(o => ['completed', 'paid'].includes(o.payment_status));
    const refundedOrders = filteredOrders.filter(o => o.payment_status === 'refunded');
    
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total_price - (o.discount_amount || 0)), 0);
    const totalTickets = paidOrders.reduce((sum, o) => sum + o.quantity, 0);
    const totalAdSpend = dispersions.reduce((sum, d) => sum + (d.ad_spend || 0), 0);
    const globalRoas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : null;

    return {
      totalRevenue,
      totalTickets,
      totalAdSpend,
      globalRoas,
    };
  }, [filteredOrders, dispersions]);

  // Calculate event finance data
  const eventFinanceData = useMemo(() => {
    const eventMap = new Map(events.map(e => [e.id, e]));
    const commissionMap = new Map(commissions.map(c => [c.event_id, c.commission_rate]));
    const dispersionMap = new Map<string, number>();
    
    dispersions.forEach(d => {
      dispersionMap.set(d.event_id, (dispersionMap.get(d.event_id) || 0) + (d.ad_spend || 0));
    });

    const eventData: EventFinanceData[] = [];
    
    // Filter events based on eventFilter
    let eventsToProcess = events.filter(e => e.status === 'active');
    if (eventFilter !== 'all') {
      eventsToProcess = eventsToProcess.filter(e => e.id === eventFilter);
    }

    eventsToProcess.forEach(event => {
      const eventOrders = filteredOrders.filter(o => o.event_id === event.id);
      const paidOrders = eventOrders.filter(o => ['completed', 'paid'].includes(o.payment_status));
      const refundedOrders = eventOrders.filter(o => o.payment_status === 'refunded');

      const tickets_sold = paidOrders.reduce((sum, o) => sum + o.quantity, 0);
      const revenue = paidOrders.reduce((sum, o) => sum + (o.total_price - (o.discount_amount || 0)), 0);
      const refunds_count = refundedOrders.length;
      const refunds_amount = refundedOrders.reduce((sum, o) => sum + o.total_price, 0);
      const commission_rate = commissionMap.get(event.id) || 0.15; // Default 15%
      const commission_amount = revenue * commission_rate;
      const net_producer = revenue - commission_amount;
      const ad_spend = dispersionMap.get(event.id) || 0;
      const roas = ad_spend > 0 ? revenue / ad_spend : null;

      eventData.push({
        id: event.id,
        name: event.name,
        venue_name: getVenueName(event.venue_id, venueMap),
        venue_city: getVenueCity(event.venue_id, venueMap),
        tickets_sold,
        revenue,
        refunds_count,
        refunds_amount,
        commission_rate,
        commission_amount,
        net_producer,
        ad_spend,
        roas,
      });
    });

    return eventData.sort((a, b) => b.revenue - a.revenue);
  }, [events, filteredOrders, commissions, dispersions, venueMap, eventFilter]);

  // Load drill-down data for selected event
  useEffect(() => {
    if (!drillDownEventId) {
      setDrillDownData(null);
      return;
    }

    async function loadDrillDown() {
      try {
        const event = events.find(e => e.id === drillDownEventId);
        if (!event) return;

        const eventOrders = filteredOrders.filter(o => 
          o.event_id === drillDownEventId && 
          ['completed', 'paid'].includes(o.payment_status)
        );

        // Zone breakdown
        const zoneRevenue = new Map<string, { sold: number; revenue: number }>();
        eventOrders.forEach(order => {
          const current = zoneRevenue.get(order.zone_name) || { sold: 0, revenue: 0 };
          current.sold += order.quantity;
          current.revenue += (order.total_price - (order.discount_amount || 0));
          zoneRevenue.set(order.zone_name, current);
        });

        const eventZones = zones.filter(z => z.event_id === drillDownEventId);
        const zoneMap = new Map(eventZones.map(z => [z.zone_name, z.price]));

        const totalRevenue = Array.from(zoneRevenue.values()).reduce((sum, z) => sum + z.revenue, 0);
        
        const zoneBreakdown: ZoneBreakdown[] = Array.from(zoneRevenue.entries()).map(([zone, data]) => ({
          zone,
          price: zoneMap.get(zone) || 0,
          sold: data.sold,
          revenue: data.revenue,
          percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        }));

        // Schedule breakdown
        const eventSchedules = schedules.filter(s => s.event_id === drillDownEventId);
        const scheduleBreakdown: ScheduleBreakdown[] = [];

        for (const schedule of eventSchedules) {
          const scheduleInventory = inventory.filter(inv => inv.schedule_id === schedule.id);
          const scheduleOrders = eventOrders.filter(o => o.schedule_id === schedule.id);
          
          // Sold: prefer inventory, fallback to order quantity
          let sold = scheduleInventory.reduce((sum, inv) => sum + inv.sold, 0);
          if (sold === 0 && scheduleOrders.length > 0) {
            sold = scheduleOrders.reduce((sum, o) => sum + o.quantity, 0);
          }
          
          // Capacity: from inventory (sold + available = Dulos allocation, NOT venue capacity)
          // Fallback to event-level ticket_zones total_capacity if inventory not loaded
          let capacity = scheduleInventory.reduce((sum, inv) => sum + (inv.sold + inv.available), 0);
          if (capacity === 0) {
            capacity = eventZones.reduce((sum, z) => sum + (z.total_capacity || 0), 0);
          }
          
          // Revenue from orders
          let revenue = 0;
          
          if (scheduleOrders.length > 0) {
            revenue = scheduleOrders.reduce((sum, o) => sum + (o.total_price - (o.discount_amount || 0)), 0);
          } else {
            // Legacy orders without schedule_id - estimate from zone prices
            const avgRevenuePerTicket = totalRevenue / Math.max(1, eventOrders.reduce((sum, o) => sum + o.quantity, 0));
            revenue = sold * avgRevenuePerTicket;
          }

          // Per-zone breakdown for this schedule
          const zoneBreakdownForSchedule: ScheduleZoneBreakdown[] = [];
          for (const zone of eventZones) {
            const zoneInv = scheduleInventory.find(inv => inv.zone_id === zone.zone_name || inv.zone_id === (zone as any).id);
            const zoneSold = zoneInv ? zoneInv.sold : scheduleOrders.filter(o => o.zone_name === zone.zone_name).reduce((sum, o) => sum + o.quantity, 0);
            const zoneCap = zoneInv ? (zoneInv.sold + zoneInv.available) : (zone.total_capacity || 0);
            const zoneRevenue = scheduleOrders.filter(o => o.zone_name === zone.zone_name).reduce((sum, o) => sum + (o.total_price - (o.discount_amount || 0)), 0);
            
            if (zoneSold > 0 || zoneCap > 0) {
              zoneBreakdownForSchedule.push({
                zone: zone.zone_name,
                sold: zoneSold,
                capacity: zoneCap,
                revenue: zoneRevenue,
              });
            }
          }

          scheduleBreakdown.push({
            date: fmtDate(schedule.date),
            time: fmtTime(schedule.start_time),
            sold,
            capacity,
            occupancy: capacity > 0 ? (sold / capacity) * 100 : 0,
            revenue,
            zones: zoneBreakdownForSchedule,
          });
        }

        // Sales trend (daily revenue for this event)
        const dailyRevenue = new Map<string, number>();
        eventOrders.forEach(order => {
          const date = order.purchased_at.split('T')[0];
          const revenue = order.total_price - (order.discount_amount || 0);
          dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + revenue);
        });

        const salesTrend: SalesTrendPoint[] = Array.from(dailyRevenue.entries())
          .map(([date, revenue]) => ({ date, revenue }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setDrillDownData({
          zones: zoneBreakdown,
          schedules: scheduleBreakdown,
          salesTrend,
        });
      } catch (error) {
        console.error('Error loading drill-down data:', error);
        toast.error('Error cargando desglose del evento');
      }
    }

    loadDrillDown();
  }, [drillDownEventId, filteredOrders, events, schedules, inventory, zones]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonTable />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-400">
        <p className="text-sm font-medium">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 text-xs text-red-400 hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#111] text-gray-400 hover:text-white'
              }`}
            >
              {range === 'all' ? 'Todo' : range}
            </button>
          ))}
        </div>

        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="bg-[#111] text-white border border-gray-700 rounded-lg px-3 py-1 text-sm"
        >
          <option value="all">Todos los eventos</option>
          {events.filter(e => e.status === 'active').map(event => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Revenue Total</p>
          <p className="text-2xl font-black text-green-400">{fmtCurrency(kpis.totalRevenue)}</p>
        </div>

        <div className="bg-[#111] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Boletos Vendidos</p>
          <p className="text-2xl font-black text-white">{kpis.totalTickets.toLocaleString()}</p>
        </div>

        <div className="bg-[#111] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Ad Spend Total</p>
          <p className="text-2xl font-black text-blue-400">
            {kpis.totalAdSpend > 0 ? fmtCurrency(kpis.totalAdSpend) : '—'}
          </p>
        </div>

        <div className="bg-[#111] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">ROAS Global</p>
          <p className="text-2xl font-black text-yellow-400">
            {kpis.globalRoas !== null ? `${kpis.globalRoas.toFixed(1)}x` : '—'}
          </p>
        </div>
      </div>

      {/* Cross-Event Table */}
      <div className="bg-[#111] rounded-xl">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Finanzas por Evento</h2>
          <p className="text-xs text-gray-400">Click en una fila para ver desglose detallado</p>
        </div>

        {eventFinanceData.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">No hay datos disponibles para el rango seleccionado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 text-xs text-gray-400 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Evento</th>
                  <th className="px-4 py-3 text-right">Boletos</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Reembolsos</th>
                  <th className="px-4 py-3 text-right">Comisión %</th>
                  <th className="px-4 py-3 text-right">Comisión $</th>
                  <th className="px-4 py-3 text-right">Neto Productor</th>
                  <th className="px-4 py-3 text-right">Ad Spend</th>
                  <th className="px-4 py-3 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {eventFinanceData.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => {
                      setDrillDownEventId(drillDownEventId === event.id ? null : event.id);
                      setExpandedSchedules(new Set());
                    }}
                    className="hover:bg-gray-900/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">
                          {drillDownEventId === event.id ? '▲' : '▼'}
                        </span>
                        <div>
                          <div className="font-medium text-white">{event.name}</div>
                          <div className="text-xs text-gray-400">
                            {event.venue_name}
                            {event.venue_city && ` · ${event.venue_city}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      {event.tickets_sold.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-green-400 font-medium">
                      {fmtCurrency(event.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-400 font-medium">
                      {event.refunds_count > 0 ? (
                        <div>
                          <div>{event.refunds_count}</div>
                          <div className="text-xs">{fmtCurrency(event.refunds_amount)}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {(event.commission_rate * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-right text-orange-400 font-medium">
                      {fmtCurrency(event.commission_amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400 font-medium">
                      {fmtCurrency(event.net_producer)}
                    </td>
                    <td className="px-4 py-3 text-right text-purple-400 font-medium">
                      {event.ad_spend > 0 ? fmtCurrency(event.ad_spend) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-400 font-medium">
                      {event.roas !== null ? `${event.roas.toFixed(1)}x` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Event Drill-Down */}
      {drillDownEventId && drillDownData && (
        <div className="space-y-6">
          {/* Zone Breakdown */}
          <div className="bg-[#111] rounded-xl">
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Desglose por Zona</h3>
              <p className="text-xs text-gray-400">Revenue por zona de boletos</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 text-xs text-gray-400 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Zona</th>
                    <th className="px-4 py-3 text-right">Precio</th>
                    <th className="px-4 py-3 text-right">Vendidos</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">% del Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {drillDownData.zones.map((zone, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-white font-medium">{zone.zone}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{fmtCurrency(zone.price)}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">{zone.sold}</td>
                      <td className="px-4 py-3 text-right text-green-400 font-medium">{fmtCurrency(zone.revenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{zone.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Schedule Breakdown */}
          <div className="bg-[#111] rounded-xl">
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Desglose por Función</h3>
              <p className="text-xs text-gray-400">Ventas por fecha y función</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 text-xs text-gray-400 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Hora</th>
                    <th className="px-4 py-3 text-right">Vendidos</th>
                    <th className="px-4 py-3 text-right">Capacidad</th>
                    <th className="px-4 py-3 text-right">Ocupación %</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {drillDownData.schedules.map((schedule, index) => (
                    <React.Fragment key={index}>
                      <tr 
                        className={`cursor-pointer hover:bg-gray-800 transition-colors ${expandedSchedules.has(index) ? 'bg-gray-800/50' : ''}`}
                        onClick={() => {
                          setExpandedSchedules(prev => {
                            const next = new Set(prev);
                            next.has(index) ? next.delete(index) : next.add(index);
                            return next;
                          });
                        }}
                      >
                        <td className="px-4 py-3 text-white font-medium">
                          <span className="mr-2 text-gray-500">{expandedSchedules.has(index) ? '▼' : '▶'}</span>
                          {schedule.date}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{schedule.time}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">{schedule.sold}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{schedule.capacity}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${
                            schedule.occupancy >= 80 ? 'text-green-400' :
                            schedule.occupancy >= 60 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {schedule.occupancy.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-green-400 font-medium">
                          {fmtCurrency(schedule.revenue)}
                        </td>
                      </tr>
                      {expandedSchedules.has(index) && schedule.zones.length > 0 && (
                        schedule.zones.map((zone, zi) => (
                          <tr key={`${index}-z${zi}`} className="bg-gray-900/50">
                            <td className="px-4 py-2 pl-10 text-gray-400 text-sm" colSpan={2}>
                              {zone.zone}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-300 text-sm">{zone.sold}</td>
                            <td className="px-4 py-2 text-right text-gray-500 text-sm">{zone.capacity}</td>
                            <td className="px-4 py-2 text-right text-gray-500 text-sm">
                              {zone.capacity > 0 ? `${((zone.sold / zone.capacity) * 100).toFixed(1)}%` : '—'}
                            </td>
                            <td className="px-4 py-2 text-right text-green-400/70 text-sm">
                              {fmtCurrency(zone.revenue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales Trend Chart */}
          {drillDownData.salesTrend.length > 0 && (
            <div className="bg-[#111] rounded-xl">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-lg font-bold text-white">Tendencia de Ventas</h3>
                <p className="text-xs text-gray-400">Revenue diario para este evento</p>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={drillDownData.salesTrend}>
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => fmtDate(date)}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    />
                    <YAxis
                      tickFormatter={fmtCurrency}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff'
                      }}
                      labelFormatter={(date) => fmtDate(date)}
                      formatter={(value) => [fmtCurrency(Number(value)), 'Revenue']}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10B981"
                      fill="url(#salesGradient)"
                      strokeWidth={2}
                    />
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}