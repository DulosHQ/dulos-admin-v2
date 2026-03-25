'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { exportFinancePdf } from '../lib/exportPdf';
import FinanceScorecard from '../components/FinanceScorecard';
// CapacityBars removed — capacity integrated into Ingresos table
import {
  fetchZones,
  fetchAllOrders,
  fetchSchedules,
  fetchAllEvents,
  fetchTickets,
  fetchRevenueByEvent,
  fetchSalesSummary,
  fetchTransactionsPaginated,
  fetchEventSections,
  fetchDispersions,
  DulosEvent,
  TicketZone,
  Ticket,
  Order,
  Schedule,
  SalesSummary,
  EventSection,
  DispersionFull,
} from '../lib/supabase';

type TabKey = 'ingresos' | 'tendencias' | 'transacciones' | 'comisiones';
type DateRange = '7d' | '30d' | '90d' | 'all' | 'custom';

interface ScheduleDisplay {
  name: string;
  date: string;
  capacity: number;
  sold: number;
  percentage: number;
  eventId: string;
}

interface Transaction {
  id: string;
  customer_name: string;
  customer_email: string;
  event_name: string;
  zone_name: string;
  amount: number;
  date: string;
  status: string;
  ticket_count?: number;
}

interface ZoneRevenue {
  zone: string;
  revenue: number;
}

const tabs: { key: TabKey; label: string }[] = [
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'tendencias', label: 'Tendencias' },
  { key: 'transacciones', label: 'Transacciones' },
  { key: 'comisiones', label: 'Comisiones' },
];

const dateRangeOptions: { key: DateRange; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'Todo' },
  { key: 'custom', label: 'Rango' },
];

const ZONE_COLORS: Record<string, string> = {
  General: '#3B82F6',
  Dorada: '#F59E0B',
  Preferente: '#8B5CF6',
};
const ZONE_COLOR_FALLBACKS = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444'];

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(value);
}

function fmtShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(d);
}

function fmtAxisCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function SkeletonCard() {
  return (
    <div className="metric-card animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
    </div>
  );
}

const PER_PAGE = 10;

export default function FinancePage() {
  // Tab & filter state
  const [activeTab, setActiveTab] = useState<TabKey>('ingresos');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [loading, setLoading] = useState(true);

  // "Aplicar Filtros" pattern: pending state until user clicks "Aplicar"
  const [pendingEvent, setPendingEvent] = useState('');
  const [pendingDateRange, setPendingDateRange] = useState<DateRange>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [filtersApplied, setFiltersApplied] = useState(false);

  const applyFilters = () => {
    setSelectedEvent(pendingEvent);
    setDateRange(pendingDateRange);
    setFiltersApplied(true);
    setTxPage(0);
  };

  const clearFilters = () => {
    setPendingEvent('');
    setPendingDateRange('all');
    setCustomDateFrom('');
    setCustomDateTo('');
    setSelectedEvent('');
    setDateRange('all');
    setFiltersApplied(false);
    setTxPage(0);
  };

  const hasFilterChanges = pendingEvent !== selectedEvent || pendingDateRange !== dateRange || (pendingDateRange === 'custom' && (customDateFrom || customDateTo));

  // Raw data
  const [events, setEvents] = useState<DulosEvent[]>([]);
  const [rawZones, setRawZones] = useState<TicketZone[]>([]);
  const [rawTickets, setRawTickets] = useState<Ticket[]>([]);
  const [rawSchedules, setRawSchedules] = useState<Schedule[]>([]);
  const [rawEventRevenues, setRawEventRevenues] = useState<{ event_id: string; event_name: string; revenue: number; image_url?: string }[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary[]>([]);
  const [rawOrders, setRawOrders] = useState<Order[]>([]);
  const [pedidosData] = useState<{ headers: string[]; rows: any[]; totalRows: number }>({ headers: [], rows: [], totalRows: 0 });
  const [dispersions, setDispersions] = useState<DispersionFull[]>([]);

  // UI state
  const [expandedCapacity, setExpandedCapacity] = useState<number | null>(null);
  const [expandedRevenueEvent, setExpandedRevenueEvent] = useState<string | null>(null);
  const [expandedEventZones, setExpandedEventZones] = useState<TicketZone[]>([]);
  const [expandedEventSections, setExpandedEventSections] = useState<EventSection[]>([]);
  const [txSearch, setTxSearch] = useState('');
  const [txSort, setTxSort] = useState<{ col: keyof Transaction; asc: boolean }>({ col: 'date', asc: false });
  const [txPage, setTxPage] = useState(0);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Server-side transaction state
  const [serverTxData, setServerTxData] = useState<Order[]>([]);
  const [serverTxCount, setServerTxCount] = useState(0);
  const [serverTxLoading, setServerTxLoading] = useState(false);

  // Fetch all data once
  useEffect(() => {
    async function loadData() {
      try {
        const [zones, ordersData, schedulesData, eventsData, tickets, revenueByEvent, salesSummaryData, dispersionsData] = await Promise.all([
          fetchZones().catch(() => [] as TicketZone[]),
          fetchAllOrders().catch(() => []),
          fetchSchedules().catch(() => [] as Schedule[]),
          fetchAllEvents().catch(() => [] as DulosEvent[]),
          fetchTickets().catch(() => [] as Ticket[]),
          fetchRevenueByEvent().catch(() => []),
          fetchSalesSummary().catch(() => [] as SalesSummary[]),
          Promise.resolve([]) as Promise<DispersionFull[]> /* dispersions table pending */,
        ]);
        setRawZones(zones);
        setRawTickets(tickets);
        setRawSchedules(schedulesData);
        setEvents(eventsData);
        setRawEventRevenues(revenueByEvent);
        setSalesSummary(salesSummaryData);
        setRawOrders(ordersData);
        setDispersions(dispersionsData);
      } catch (error) {
        console.error('Error loading finance data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute all derived data
  const computed = useMemo(() => {
    if (loading) return null;

    const eventMap = new Map(events.map(e => [e.id, e]));

    // Filter sales summary by event first
    const filteredSalesSummary = selectedEvent
      ? salesSummary.filter(s => s.event_id === selectedEvent)
      : salesSummary;

    // Zone price lookup
    const zonePriceMap = new Map<string, number>();
    rawZones.forEach(z => {
      zonePriceMap.set(`${z.event_id}:${z.zone_name}`, z.price);
    });

    // Date cutoff
    let cutoff: Date | null = null;
    let cutoffEnd: Date | null = null;
    if (dateRange === 'custom') {
      if (customDateFrom) cutoff = new Date(customDateFrom + 'T00:00:00');
      if (customDateTo) cutoffEnd = new Date(customDateTo + 'T23:59:59');
    } else if (dateRange !== 'all') {
      cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90));
    }

    // Filter zones & tickets by event
    const filteredZones = selectedEvent ? rawZones.filter(z => z.event_id === selectedEvent) : rawZones;
    const eventFilteredTickets = selectedEvent ? rawTickets.filter(t => t.event_id === selectedEvent) : rawTickets;

    // Filter tickets by date
    const filteredTickets = (cutoff || cutoffEnd)
      ? eventFilteredTickets.filter(t => {
          const d = new Date(t.created_at);
          if (cutoff && d < cutoff) return false;
          if (cutoffEnd && d > cutoffEnd) return false;
          return true;
        })
      : eventFilteredTickets;

    // Filter schedules by event
    const filteredSchedules = selectedEvent ? rawSchedules.filter(s => s.event_id === selectedEvent) : rawSchedules;

    // Event revenues from sales summary (REAL DATA)
    // Aggregate events with same name (different venues) into one row
    const eventAggMap = new Map<string, { event_ids: string[]; event_name: string; venues: { venue_name: string; event_id: string; revenue: number; orders: number; tickets: number }[]; revenue: number; orders: number; tickets: number; refunded: number; image_url?: string }>();
    filteredSalesSummary.forEach(s => {
      const existing = eventAggMap.get(s.event_name);
      if (existing) {
        existing.event_ids.push(s.event_id);
        existing.venues.push({ venue_name: s.venue_name || '', event_id: s.event_id, revenue: s.total_revenue, orders: s.total_orders, tickets: s.total_tickets_sold });
        existing.revenue += s.total_revenue;
        existing.orders += s.total_orders;
        existing.tickets += s.total_tickets_sold;
        existing.refunded += s.refunded || 0;
      } else {
        eventAggMap.set(s.event_name, {
          event_ids: [s.event_id],
          event_name: s.event_name,
          venues: [{ venue_name: s.venue_name || '', event_id: s.event_id, revenue: s.total_revenue, orders: s.total_orders, tickets: s.total_tickets_sold }],
          revenue: s.total_revenue,
          orders: s.total_orders,
          tickets: s.total_tickets_sold,
          refunded: s.refunded || 0,
          image_url: eventMap.get(s.event_id)?.image_url,
        });
      }
    });

    // Compute actual tickets sold AND revenue from orders (fallback when v_sales_summary is stale)
    const orderTicketsByEvent = new Map<string, number>();
    const orderRevenueByEvent = new Map<string, number>();
    rawOrders.filter(o => o.payment_status === 'completed').forEach(o => {
      orderTicketsByEvent.set(o.event_id, (orderTicketsByEvent.get(o.event_id) || 0) + (o.quantity || 1));
      orderRevenueByEvent.set(o.event_id, (orderRevenueByEvent.get(o.event_id) || 0) + (o.total_price || 0));
    });

    const eventRevenues = Array.from(eventAggMap.values()).map(e => {
      // Use orders-based ticket count when v_sales_summary returns 0 but orders exist
      const orderBasedTickets = e.event_ids.reduce((sum, eid) => sum + (orderTicketsByEvent.get(eid) || 0), 0);
      const realTickets = e.tickets > 0 ? e.tickets : orderBasedTickets;
      // Use orders-based revenue when it's higher than summary (summary may be stale)
      const orderBasedRevenue = e.event_ids.reduce((sum, eid) => sum + (orderRevenueByEvent.get(eid) || 0), 0);
      const realRevenue = Math.max(e.revenue, orderBasedRevenue);
      // Also fix per-venue tickets and revenue
      const enrichedVenues = e.venues.map(v => ({
        ...v,
        tickets: v.tickets > 0 ? v.tickets : (orderTicketsByEvent.get(v.event_id) || 0),
        revenue: Math.max(v.revenue, orderRevenueByEvent.get(v.event_id) || 0),
      }));
      return {
        event_id: e.event_ids[0],
        event_ids: e.event_ids,
        event_name: e.event_name,
        venues: enrichedVenues,
        revenue: realRevenue,
        orders: e.orders,
        tickets: realTickets,
        refunded: e.refunded || 0,
        image_url: e.image_url,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // --- Scorecard using Sales Summary (REAL DATA) ---

    // Use real revenue — prefer orders when higher than v_sales_summary (which may be stale)
    const summaryRevenue = filteredSalesSummary.reduce((sum, s) => sum + s.total_revenue, 0);
    const ordersRevenue = filteredSalesSummary.reduce((sum, s) => sum + (orderRevenueByEvent.get(s.event_id) || 0), 0);
    const totalRevenue = Math.max(summaryRevenue, ordersRevenue);
    const totalOrders = filteredSalesSummary.reduce((sum, s) => sum + s.total_orders, 0);
    const summaryTickets = filteredSalesSummary.reduce((sum, s) => sum + s.total_tickets_sold, 0);
    const orderBasedTotalTickets = filteredSalesSummary.reduce((sum, s) => sum + (orderTicketsByEvent.get(s.event_id) || 0), 0);
    const totalTicketsSold = summaryTickets > 0 ? summaryTickets : orderBasedTotalTickets;

    // Keep zone-based calculations for occupancy (as per requirements) — enriched with order data
    const orderSoldByZone = new Map<string, number>();
    rawOrders.filter(o => o.payment_status === 'completed').forEach(o => {
      const key = `${o.event_id}:${o.zone_name}`;
      orderSoldByZone.set(key, (orderSoldByZone.get(key) || 0) + (o.quantity || 1));
    });
    const totalSold = filteredZones.reduce((sum, z) => {
      const orderSold = orderSoldByZone.get(`${z.event_id}:${z.zone_name}`) || 0;
      return sum + Math.max(z.sold, orderSold);
    }, 0);
    const totalAvailable = filteredZones.reduce((sum, z) => sum + z.available + z.sold, 0);
    const occupancyPercent = totalAvailable > 0 ? (totalSold / totalAvailable) * 100 : 0;
    const aov = totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0;

    const scorecardData = {
      revenue: totalRevenue,
      revenuePrevious: totalRevenue || 1,
      aov,
      aovPrevious: aov || 1,
      completedOrders: totalOrders,
      completedOrdersPrevious: totalOrders || 1,
      occupancyPercent,
      occupancyPercentPrevious: occupancyPercent || 1,
    };

    // --- Zone revenues (prefer orders-based revenue when available) ---
    const zoneRevenueMap = new Map<string, number>();
    // First compute from orders (accurate)
    const orderRevenueByZone = new Map<string, number>();
    rawOrders.filter(o => o.payment_status === 'completed').forEach(o => {
      const eventMatch = !selectedEvent || o.event_id === selectedEvent;
      if (eventMatch) {
        orderRevenueByZone.set(o.zone_name, (orderRevenueByZone.get(o.zone_name) || 0) + (o.total_price || 0));
      }
    });
    // Merge: use order revenue if available, fallback to zone calc
    filteredZones.forEach(z => {
      const orderRev = orderRevenueByZone.get(z.zone_name) || 0;
      const zoneRev = orderRev > 0 ? orderRev : z.sold * z.price;
      zoneRevenueMap.set(z.zone_name, (zoneRevenueMap.get(z.zone_name) || 0) + zoneRev);
    });
    // Add zones from orders that don't exist in ticket_zones
    orderRevenueByZone.forEach((rev, zoneName) => {
      if (!zoneRevenueMap.has(zoneName) && rev > 0) {
        zoneRevenueMap.set(zoneName, rev);
      }
    });
    const zoneRevenues: ZoneRevenue[] = Array.from(zoneRevenueMap.entries())
      .map(([zone, revenue]) => ({ zone, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Donut data
    const donutData = zoneRevenues.map((z, i) => ({
      name: z.zone,
      value: z.revenue,
      color: ZONE_COLORS[z.zone] || ZONE_COLOR_FALLBACKS[i % ZONE_COLOR_FALLBACKS.length],
    }));
    const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

    // --- Daily revenue chart (from tickets) ---
    const dailyMap = new Map<string, number>();
    filteredTickets.forEach(t => {
      const dateStr = t.created_at.split('T')[0];
      const price = zonePriceMap.get(`${t.event_id}:${t.zone_name}`) || 0;
      dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + price);
    });
    const dailyRevenueData = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date, label: fmtShortDate(date), amount }));

    // --- Schedules for capacity ---
    const schedulesDisplay: ScheduleDisplay[] = filteredSchedules.map(s => {
      const event = eventMap.get(s.event_id);
      const capacity = s.total_capacity || 0;
      const sold = s.sold_capacity || 0;
      const percentage = capacity > 0 ? (sold / capacity) * 100 : 0;
      return {
        name: event?.name || s.event_id,
        date: `${s.date}T${s.start_time}`,
        capacity,
        sold,
        percentage,
        eventId: s.event_id,
      };
    }).sort((a, b) => b.percentage - a.percentage);

    // Zone breakdown per event for capacity expansion
    const zonesByEvent: Record<string, { zone_name: string; sold: number; total: number; percentage: number }[]> = {};
    const zoneEventMap = new Map<string, Map<string, { sold: number; available: number }>>();
    rawZones.forEach(z => {
      if (!zoneEventMap.has(z.event_id)) zoneEventMap.set(z.event_id, new Map());
      const em = zoneEventMap.get(z.event_id)!;
      const existing = em.get(z.zone_name) || { sold: 0, available: 0 };
      existing.sold += z.sold;
      existing.available += z.available;
      em.set(z.zone_name, existing);
    });
    zoneEventMap.forEach((zones, eventId) => {
      zonesByEvent[eventId] = Array.from(zones.entries()).map(([zone_name, data]) => {
        const total = data.sold + data.available;
        return { zone_name, sold: data.sold, total, percentage: total > 0 ? (data.sold / total) * 100 : 0 };
      }).sort((a, b) => b.percentage - a.percentage);
    });

    // Capacity stats
    const critical = schedulesDisplay.filter(s => s.percentage > 80).length;
    const high = schedulesDisplay.filter(s => s.percentage >= 50 && s.percentage <= 80).length;
    const normal = schedulesDisplay.filter(s => s.percentage < 50).length;
    const totalCapacity = schedulesDisplay.reduce((sum, s) => sum + s.capacity, 0);
    const capacityStats = { critical, high, normal, totalCapacity };

    // --- Transactions ---
    // Build customer lookup from orders (tickets often lack customer_name)
    const orderCustomerMap = new Map<string, { name: string; email: string }>();
    rawOrders.forEach(o => {
      if (o.id) orderCustomerMap.set(o.id, { name: o.customer_name || '', email: o.customer_email || '' });
    });

    const transactions: Transaction[] = filteredTickets.map(ticket => {
      const event = eventMap.get(ticket.event_id);
      const price = zonePriceMap.get(`${ticket.event_id}:${ticket.zone_name}`) || 0;
      // Resolve customer from order if ticket has no name
      const orderInfo = ticket.order_id ? orderCustomerMap.get(ticket.order_id) : undefined;
      const customerName = ticket.customer_name || orderInfo?.name || '';
      const customerEmail = ticket.customer_email || orderInfo?.email || '';
      return {
        id: ticket.ticket_number,
        customer_name: customerName,
        customer_email: customerEmail,
        event_name: event?.name || ticket.event_id,
        zone_name: ticket.zone_name,
        amount: price,
        date: ticket.created_at,
        status: ticket.status === 'valid' ? 'Completado' : ticket.status === 'used' ? 'Usado' : ticket.status === 'refunded' ? 'Reembolsado' : 'Pendiente',
      };
    });

    // --- Tendencias: Sales by day of week ---
    const dayOfWeekTotals = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    filteredTickets.forEach(t => {
      const day = new Date(t.created_at).getDay();
      const price = zonePriceMap.get(`${t.event_id}:${t.zone_name}`) || 0;
      dayOfWeekTotals[day] += price;
    });
    // Reorder to Mon-Sun
    const dayOfWeekData = [1, 2, 3, 4, 5, 6, 0].map(i => ({
      day: DAY_NAMES[i],
      sales: dayOfWeekTotals[i],
    }));

    // --- Tendencias: Occupancy by event ---
    const eventOccupancy: { name: string; occupancy: number; image_url?: string }[] = [];
    const eventZoneAgg = new Map<string, { sold: number; total: number }>();
    rawZones.forEach(z => {
      const agg = eventZoneAgg.get(z.event_id) || { sold: 0, total: 0 };
      agg.sold += z.sold;
      agg.total += z.sold + z.available;
      eventZoneAgg.set(z.event_id, agg);
    });
    eventZoneAgg.forEach((agg, eventId) => {
      const event = eventMap.get(eventId);
      if (event) {
        eventOccupancy.push({
          name: event.name.length > 20 ? event.name.substring(0, 20) + '...' : event.name,
          occupancy: agg.total > 0 ? Math.round((agg.sold / agg.total) * 100) : 0,
          image_url: event.image_url,
        });
      }
    });
    eventOccupancy.sort((a, b) => b.occupancy - a.occupancy);

    // --- Tendencias: Summary stats ---
    const bestDayIdx = dayOfWeekTotals.indexOf(Math.max(...dayOfWeekTotals));
    const bestDay = DAY_NAMES[bestDayIdx];
    const avgTicketPrice = filteredTickets.length > 0
      ? filteredTickets.reduce((sum, t) => sum + (zonePriceMap.get(`${t.event_id}:${t.zone_name}`) || 0), 0) / filteredTickets.length
      : 0;

    // Most popular event by ticket count
    const eventTicketCount = new Map<string, number>();
    filteredTickets.forEach(t => {
      eventTicketCount.set(t.event_id, (eventTicketCount.get(t.event_id) || 0) + 1);
    });
    let popularEventId = '';
    let popularEventCount = 0;
    eventTicketCount.forEach((count, eid) => {
      if (count > popularEventCount) { popularEventId = eid; popularEventCount = count; }
    });
    const popularEvent = eventMap.get(popularEventId)?.name || '-';

    // Most popular zone
    const zoneTicketCount = new Map<string, number>();
    filteredTickets.forEach(t => {
      zoneTicketCount.set(t.zone_name, (zoneTicketCount.get(t.zone_name) || 0) + 1);
    });
    let popularZone = '-';
    let popularZoneCount = 0;
    zoneTicketCount.forEach((count, name) => {
      if (count > popularZoneCount) { popularZone = name; popularZoneCount = count; }
    });

    const summaryStats = { bestDay, avgTicketPrice, popularEvent, popularZone };

    // --- UTM / Marketing / Geo data from orders ---
    const utmSourceMap = new Map<string, { count: number; revenue: number }>();
    const deviceMap = new Map<string, number>();
    const cityMap = new Map<string, { count: number; revenue: number }>();
    const browserMap = new Map<string, number>();
    const filteredOrders = selectedEvent ? rawOrders.filter(o => o.event_id === selectedEvent) : rawOrders;
    filteredOrders.forEach(o => {
      const source = o.utm_source || 'Directo';
      const existing = utmSourceMap.get(source) || { count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += o.total_price || 0;
      utmSourceMap.set(source, existing);

      const device = o.device_type || 'Desconocido';
      deviceMap.set(device, (deviceMap.get(device) || 0) + 1);

      // Geo
      const city = o.city || 'Desconocida';
      const cityData = cityMap.get(city) || { count: 0, revenue: 0 };
      cityData.count++;
      cityData.revenue += o.total_price || 0;
      cityMap.set(city, cityData);

      // Browser
      const browser = o.browser || 'Desconocido';
      browserMap.set(browser, (browserMap.get(browser) || 0) + 1);
    });
    const utmSources = Array.from(utmSourceMap.entries())
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
    const deviceBreakdown = Array.from(deviceMap.entries())
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count);
    const cityBreakdown = Array.from(cityMap.entries())
      .map(([city, data]) => ({ city, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    const browserBreakdown = Array.from(browserMap.entries())
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // --- Commission calculations — real dispersions if available, fallback 15% ---
    const hasRealDispersions = dispersions.length > 0;
    const totalComissionRevenue = filteredSalesSummary.reduce((sum, s) => sum + s.total_revenue, 0);

    let dulosCommission: number;
    let producerShare: number;
    let realDispersions: DispersionFull[] = [];

    if (hasRealDispersions) {
      const filteredDisp = selectedEvent ? dispersions.filter(d => d.event_id === selectedEvent) : dispersions;
      realDispersions = filteredDisp;
      dulosCommission = filteredDisp.reduce((s, d) => s + d.platform_fee, 0);
      producerShare = filteredDisp.reduce((s, d) => s + d.net_payout, 0);
    } else {
      dulosCommission = totalComissionRevenue * 0.15;
      producerShare = totalComissionRevenue * 0.85;
    }

    const commissionData = {
      totalRevenue: totalComissionRevenue,
      dulosCommission,
      producerShare,
      hasRealDispersions,
      realDispersions,
      events: Array.from(eventAggMap.values()).map(e => {
        const disp = dispersions.find(d => d.event_id === e.event_ids[0]);
        return {
          event_id: e.event_ids[0],
          event_name: e.event_name,
          revenue: e.revenue,
          commission: disp ? disp.platform_fee : e.revenue * 0.15,
          producer: disp ? disp.net_payout : e.revenue * 0.85,
          tickets: e.tickets,
          image_url: e.image_url,
          dispersion: disp || null,
        };
      }).sort((a, b) => b.revenue - a.revenue)
    };

    // --- Transactions from pedidos data (REAL DATA) ---
    const transactionsFromPedidos: Transaction[] = [];
    if (pedidosData.rows && pedidosData.rows.length > 0) {

      pedidosData.rows.forEach(row => {
        if (!row || typeof row !== 'object') return;

        // Access row data as object with named keys (not array indexing)
        const id = row['ID Pedido'] || row.ID_Pedido || '';
        const evento = row['Evento'] || row.Evento || '';
        const clienteData = row['Cliente'] || row.Cliente || '';
        const fecha = row['Fecha'] || row.Fecha || new Date().toISOString();
        const totalStr = row['Total'] || row.Total || '$0';

        // Parse cliente (format: "Name\nEmail")
        const [customerName, customerEmail] = String(clienteData).split('\n');

        // Parse total (format: "$299")
        const amount = parseFloat(String(totalStr).replace(/[$,]/g, '')) || 0;

        const ticketCount = parseInt(String(row['Boletos'] || row.Boletos || '1'), 10) || 1;
        transactionsFromPedidos.push({
          id: String(id),
          customer_name: customerName || 'N/A',
          customer_email: customerEmail || 'N/A',
          event_name: String(evento),
          zone_name: String(row['Zona'] || row.Zona || ''),
          amount,
          date: fecha,
          status: 'Completado',
          ticket_count: ticketCount,
        });
      });
    }

    // Use pedidos transactions if available, fallback to ticket-based transactions
    const finalTransactions = transactionsFromPedidos.length > 0 ? transactionsFromPedidos : transactions;

    return {
      scorecardData,
      eventRevenues,
      zoneRevenues,
      donutData,
      donutTotal,
      dailyRevenueData,
      schedulesDisplay,
      zonesByEvent,
      capacityStats,
      transactions: finalTransactions,
      dayOfWeekData,
      eventOccupancy,
      summaryStats,
      commissionData,
      utmSources,
      deviceBreakdown,
      cityBreakdown,
      browserBreakdown,
    };
  }, [loading, events, rawZones, rawTickets, rawSchedules, rawEventRevenues, salesSummary, rawOrders, pedidosData, selectedEvent, dateRange, customDateFrom, customDateTo, dispersions]);

  // Handle revenue event drill-down
  const handleRevenueEventClick = async (eventId: string, eventIds?: string[]) => {
    if (expandedRevenueEvent === eventId) {
      setExpandedRevenueEvent(null);
      setExpandedEventZones([]);
      setExpandedEventSections([]);
      return;
    }
    setExpandedRevenueEvent(eventId);
    // Fetch zones for ALL event_ids (aggregated events)
    const ids = new Set(eventIds || [eventId]);
    const zones = rawZones.filter(z => ids.has(z.event_id));
    
    // Compute actual sold AND revenue from orders (ticket_zones.sold/price may be stale)
    const orderZoneStats = new Map<string, { sold: number; revenue: number; unitPrice: number }>();
    rawOrders
      .filter(o => ids.has(o.event_id) && o.payment_status === 'completed')
      .forEach(o => {
        const key = `${o.event_id}:${o.zone_name}`;
        const existing = orderZoneStats.get(key) || { sold: 0, revenue: 0, unitPrice: 0 };
        existing.sold += (o.quantity || 1);
        existing.revenue += (o.total_price || 0);
        existing.unitPrice = o.unit_price || existing.unitPrice;
        orderZoneStats.set(key, existing);
      });
    
    // Merge: use orders data when available (more accurate than ticket_zones)
    const enrichedZones = zones.map(z => {
      const key = `${z.event_id}:${z.zone_name}`;
      const orderStats = orderZoneStats.get(key);
      const realSold = orderStats ? Math.max(z.sold, orderStats.sold) : z.sold;
      const realPrice = orderStats ? orderStats.unitPrice : z.price;
      const realRevenue = orderStats ? orderStats.revenue : z.sold * z.price;
      const realAvailable = Math.max(0, (z.total_capacity || (z.sold + z.available)) - realSold);
      return { ...z, sold: realSold, available: realAvailable, price: realPrice, _orderRevenue: realRevenue };
    });
    
    // Also add zones that exist in orders but NOT in ticket_zones (mismatched names)
    const zoneKeys = new Set(zones.map(z => `${z.event_id}:${z.zone_name}`));
    const missingZones: typeof zones = [];
    orderZoneStats.forEach((stats, key) => {
      if (!zoneKeys.has(key)) {
        const [evId, zoneName] = [key.split(':')[0], key.split(':').slice(1).join(':')];
        missingZones.push({
          event_id: evId,
          zone_name: zoneName,
          zone_type: 'ga',
          price: stats.unitPrice,
          original_price: 0,
          available: 0,
          sold: stats.sold,
          _orderRevenue: stats.revenue,
        } as any);
      }
    });
    
    setExpandedEventZones([...enrichedZones, ...missingZones]);
    // Try to fetch event sections (Paolo's seat architecture) — silently fail if table doesn't exist
    try {
      const sections = await fetchEventSections(eventId);
      setExpandedEventSections(sections);
    } catch {
      // event_sections table may not exist yet — silent fail
      setExpandedEventSections([]);
    }
  };

  // Reset txPage when filters change
  useEffect(() => { setTxPage(0); }, [selectedEvent, dateRange, txSearch, txSort]);

  // Server-side transaction loading
  useEffect(() => {
    if (activeTab !== 'transacciones') return;
    let cancelled = false;
    async function loadTransactions() {
      setServerTxLoading(true);
      try {
        const sortColMap: Record<string, string> = {
          date: 'purchased_at',
          customer_name: 'customer_name',
          event_name: 'event_id',
          zone_name: 'zone_name',
          amount: 'total_price',
          status: 'payment_status',
          id: 'order_number',
          customer_email: 'customer_email',
        };
        const sortCol = sortColMap[txSort.col] || 'purchased_at';
        const sortDir = txSort.asc ? 'asc' as const : 'desc' as const;
        const result = await fetchTransactionsPaginated(
          txPage + 1,
          PER_PAGE,
          sortCol,
          sortDir,
          selectedEvent || undefined,
          undefined,
          txSearch || undefined
        );
        if (!cancelled) {
          setServerTxData(result.data);
          setServerTxCount(result.count);
        }
      } catch (err) {
        console.error('Error loading transactions:', err);
      } finally {
        if (!cancelled) setServerTxLoading(false);
      }
    }
    loadTransactions();
    return () => { cancelled = true; };
  }, [activeTab, txPage, txSort, txSearch, selectedEvent]);

  const exportCSV = () => {
    if (!computed) return;
    const rows = [
      ['Metrica', 'Valor'],
      ['Ingresos Totales', computed.scorecardData.revenue.toString()],
      ['AOV', computed.scorecardData.aov.toFixed(0)],
      ['Ordenes Completadas', computed.scorecardData.completedOrders.toString()],
      ['Ocupacion %', computed.scorecardData.occupancyPercent.toFixed(1)],
      ...computed.zoneRevenues.map(z => [z.zone, z.revenue.toString()]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metricas_financieras.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!computed) return;
    exportFinancePdf({
      revenue: computed.scorecardData.revenue,
      aov: computed.scorecardData.aov,
      completedOrders: computed.scorecardData.completedOrders,
      occupancyPercent: computed.scorecardData.occupancyPercent,
      eventRevenues: computed.eventRevenues,
      commissionData: computed.commissionData,
      zoneRevenues: computed.zoneRevenues,
    });
  };

  // Transaction filtering, sorting, pagination
  const processedTransactions = useMemo(() => {
    if (!computed) return { items: [] as Transaction[], total: 0 };
    let items = computed.transactions;

    // Search
    if (txSearch) {
      const q = txSearch.toLowerCase();
      items = items.filter(t =>
        t.id.toLowerCase().includes(q) ||
        t.customer_name.toLowerCase().includes(q) ||
        t.customer_email.toLowerCase().includes(q) ||
        t.event_name.toLowerCase().includes(q) ||
        t.zone_name.toLowerCase().includes(q)
      );
    }

    // Sort
    items = [...items].sort((a, b) => {
      const col = txSort.col;
      const va = a[col];
      const vb = b[col];
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return txSort.asc ? cmp : -cmp;
    });

    const total = items.length;
    const start = txPage * PER_PAGE;
    items = items.slice(start, start + PER_PAGE);

    return { items, total };
  }, [computed, txSearch, txSort, txPage]);

  const toggleSort = (col: keyof Transaction) => {
    setTxSort(prev => prev.col === col ? { col, asc: !prev.asc } : { col, asc: true });
  };

  const SortHeader = ({ col, label, align = 'left' }: { col: keyof Transaction; label: string; align?: 'left' | 'right' | 'center' }) => (
    <th
      className={`${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} py-3 px-2 sm:px-3 font-bold text-white text-[11px] sm:text-[13px] cursor-pointer select-none hover:text-gray-300 transition-colors whitespace-nowrap`}
      onClick={() => toggleSort(col)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end w-full' : ''}`}>
        {label}
        {txSort.col === col && (
          <svg className={`w-3 h-3 transition-transform ${txSort.asc ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        )}
      </span>
    </th>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!computed) return null;

  const { scorecardData, eventRevenues, zoneRevenues, donutData, donutTotal, dailyRevenueData, schedulesDisplay, zonesByEvent, capacityStats, dayOfWeekData, eventOccupancy, summaryStats, commissionData, utmSources, deviceBreakdown, cityBreakdown, browserBreakdown } = computed;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">Panel Financiero</h1>
            <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Metricas de ingresos, capacidad y tendencias</p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={exportPDF}
              className="px-2 sm:px-3 py-1.5 sm:py-2 bg-[#EF4444] text-white rounded-lg text-[10px] sm:text-xs font-bold hover:bg-[#c5303c] transition-colors flex items-center gap-1 sm:gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF
            </button>
            <button
              onClick={exportCSV}
              className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 text-gray-600 rounded-lg text-[10px] sm:text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              CSV
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Date range presets */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
            {dateRangeOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setPendingDateRange(opt.key)}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors ${
                  pendingDateRange === opt.key
                    ? 'bg-[#1E293B] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom date range inputs */}
          {pendingDateRange === 'custom' && (
            <div className="flex gap-1.5 items-center flex-shrink-0">
              <input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#EF4444]" />
              <span className="text-xs text-gray-400">→</span>
              <input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#EF4444]" />
            </div>
          )}

          {/* Event dropdown */}
          <select
            value={pendingEvent}
            onChange={e => setPendingEvent(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#EF4444] focus:border-[#EF4444]"
          >
            <option value="">Todos los Eventos</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>

          {/* Aplicar / Limpiar */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={applyFilters}
              disabled={!hasFilterChanges}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                hasFilterChanges
                  ? 'bg-[#EF4444] text-white hover:bg-[#c5303c]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Aplicar
            </button>
            {filtersApplied && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="section-card">
        <div className="flex gap-4 sm:gap-6 px-3 sm:px-5 border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative py-3 sm:py-4 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === tab.key ? 'text-[#EF4444]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#EF4444]" />}
            </button>
          ))}
        </div>
      </div>

      {/* ====== INGRESOS TAB ====== */}
      {activeTab === 'ingresos' && (
        <div className="space-y-4 animate-fade-in">
          <FinanceScorecard data={scorecardData} currency="MXN" eventName={selectedEvent ? events.find(e => e.id === selectedEvent)?.name : undefined} />

          {/* Revenue by Event — Dense Table */}
          <div className="section-card">
            <div className="section-card-header">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="section-card-title">Ingresos por Evento</span>
              <span className="ml-auto text-xs text-gray-500">{eventRevenues.length} eventos</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th className="text-right" title="Total de boletos vendidos">Vendidos</th>
                    <th className="text-right" title="Número de transacciones/compras completadas">Órdenes</th>
                    <th className="text-right" title="Ingreso total bruto">Revenue</th>
                    <th className="text-right" title="Boletos reembolsados (total o parcial)">Reembolsos</th>
                    <th className="text-right" title="Comisión Dulos del 15% sobre revenue">Comisión (15%)</th>
                    <th className="text-right" title="Capacidad total del recinto">Capacidad</th>
                    <th className="text-right" title="Porcentaje de boletos vendidos vs capacidad total">Ocupación</th>
                    <th className="text-right" title="Porcentaje del revenue total que representa este evento">% Rev</th>
                  </tr>
                </thead>
                <tbody>
                  {eventRevenues.length > 0 ? eventRevenues.map(event => {
                    const totalRev = eventRevenues.reduce((s, e) => s + e.revenue, 0);
                    const pct = totalRev > 0 ? Math.round((event.revenue / totalRev) * 100) : 0;
                    const isExpanded = expandedRevenueEvent === event.event_id;
                    const eventObj = events.find(e => e.id === event.event_id);
                    const eventType = eventObj?.event_type || 'general';
                    // Capacity from schedules (aggregate all event_ids)
                    const eIds = new Set(event.event_ids || [event.event_id]);
                    const eventSchedules = schedulesDisplay.filter(s => s.eventId && eIds.has(s.eventId));
                    const totalCap = eventSchedules.reduce((s, sc) => s + sc.capacity, 0);
                    const totalSold = eventSchedules.reduce((s, sc) => s + sc.sold, 0);
                    const occPct = totalCap > 0 ? Math.round((totalSold / totalCap) * 100) : 0;
                    const occBadge = occPct === 0 ? { cls: 'bg-gray-300 text-gray-600', label: 'SIN VENTAS' } : occPct > 80 ? { cls: 'bg-red-500', label: 'CRÍTICO' } : occPct >= 50 ? { cls: 'bg-yellow-500', label: 'ALTO' } : { cls: 'bg-green-500', label: 'NORMAL' };
                    return (
                      <React.Fragment key={event.event_id}>
                      <tr onClick={() => handleRevenueEventClick(event.event_id, event.event_ids)} className={`cursor-pointer ${isExpanded ? 'bg-red-50' : ''}`}>
                        <td>
                          <div className="flex items-center gap-2">
                            {event.image_url && (
                              <img src={event.image_url} alt={event.event_name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold truncate">{event.event_name}</span>
                                <span className={`badge ${eventType === 'recurring' ? 'badge-recurring' : eventType === 'multiday' ? 'badge-multiday' : 'badge-single'}`}>{eventType === 'recurring' ? 'Recurrente' : eventType === 'multiday' ? 'Multiday' : 'Único'}</span>
                              </div>
                              {event.venues && event.venues.length > 0 && (
                                <p className="text-[10px] text-gray-400 truncate">
                                  {event.venues.length === 1 ? event.venues[0].venue_name : `${event.venues.length} recintos`}
                                </p>
                              )}
                            </div>
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ml-auto flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </td>
                        <td className="text-right">{event.tickets.toLocaleString()}</td>
                        <td className="text-right">{event.orders.toLocaleString()}</td>
                        <td className="text-right font-bold">{fmtCurrency(event.revenue)}</td>
                        <td className="text-right">{event.refunded > 0 ? <span className="text-red-500 font-bold">{event.refunded}</span> : <span className="text-gray-300">0</span>}</td>
                        <td className="text-right font-bold text-[#EF4444]">{fmtCurrency(event.revenue * 0.15)}</td>
                        <td className="text-right text-gray-500">{totalCap > 0 ? totalCap.toLocaleString() : '—'}</td>
                        <td className="text-right">
                          {totalCap > 0 ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${occPct === 0 ? '' : 'text-white'} ${occBadge.cls}`}>{occPct}%</span>
                          ) : '—'}
                        </td>
                        <td className="text-right font-bold text-gray-900">{pct}%</td>
                      </tr>
                      {/* Drill-down: Zone breakdown + Sections (Paolo) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="bg-gray-50 p-4">
                            <div className="space-y-3">
                              {/* Venue breakdown — always show which venue(s) */}
                              {event.venues && event.venues.length >= 1 && (
                                <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Por Recinto</p>
                                  <div className="overflow-x-auto">
                                  <div className="overflow-x-auto"><table className="data-table text-xs">
                                    <thead>
                                      <tr>
                                        <th>Recinto</th>
                                        <th className="text-right" title="Boletos vendidos en este recinto">Vendidos</th>
                                        <th className="text-right" title="Número de transacciones completadas">Órdenes</th>
                                        <th className="text-right">Revenue</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {event.venues.map((v, vi) => (
                                        <tr key={vi}>
                                          <td className="font-bold">{v.venue_name || 'Sin recinto'}</td>
                                          <td className="text-right">{v.tickets}</td>
                                          <td className="text-right">{v.orders}</td>
                                          <td className="text-right font-bold">{fmtCurrency(v.revenue)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table></div>
                                  </div>
                                </div>
                              )}
                              {/* Zone revenue breakdown */}
                              {expandedEventZones.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Desglose por Zona</p>
                                  <div className="overflow-x-auto">
                                  <div className="overflow-x-auto"><table className="data-table text-xs">
                                    <thead>
                                      <tr>
                                        <th>Zona</th>
                                        <th className="text-right">Precio</th>
                                        <th className="text-right">Vendidos</th>
                                        <th className="text-right">Disponibles</th>
                                        <th className="text-right">Revenue</th>
                                        <th className="text-right">%</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {expandedEventZones.filter(z => z.sold > 0 || z.available > 0).map((z, i) => {
                                        const cap = z.sold + z.available;
                                        const occPct = cap > 0 ? Math.round((z.sold / cap) * 100) : 0;
                                        return (
                                          <tr key={i}>
                                            <td className="font-bold">{z.zone_name}</td>
                                            <td className="text-right">{fmtCurrency(z.price)}</td>
                                            <td className="text-right">{z.sold}</td>
                                            <td className="text-right">{z.available}</td>
                                            <td className="text-right font-bold text-[#EF4444]">{fmtCurrency((z as any)._orderRevenue || z.sold * z.price)}</td>
                                            <td className="text-right">
                                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${occPct === 0 ? 'bg-gray-300 text-gray-600' : 'text-white'} ${occPct === 0 ? 'bg-gray-300' : occPct >= 80 ? 'bg-red-500' : occPct >= 50 ? 'bg-yellow-500' : 'bg-green-500'}`}>
                                                {occPct}%
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table></div>
                                  </div>
                                </div>
                              )}
                              {/* Paolo's Event Sections (if event has reserved/hybrid seating) */}
                              {expandedEventSections.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Secciones de Asientos (Paolo)</p>
                                  <div className="overflow-x-auto">
                                  <div className="overflow-x-auto"><table className="data-table text-xs">
                                    <thead>
                                      <tr>
                                        <th>Sección</th>
                                        <th className="text-right">Capacidad</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {expandedEventSections.map((s, i) => (
                                        <tr key={i}>
                                          <td className="font-bold">{s.name}</td>
                                          <td className="text-right">{s.capacity}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table></div>
                                  </div>
                                </div>
                              )}
                              {expandedEventZones.length === 0 && expandedEventSections.length === 0 && (
                                <p className="text-xs text-gray-400">Sin datos de zonas o secciones para este evento</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  }) : (
                    <tr><td colSpan={9} className="text-center py-4">No hay datos de eventos disponibles</td></tr>
                  )}
                  {eventRevenues.length > 1 && (() => {
                    const totalCap = schedulesDisplay.reduce((s, sc) => s + sc.capacity, 0);
                    const totalSoldCap = schedulesDisplay.reduce((s, sc) => s + sc.sold, 0);
                    const totalOcc = totalCap > 0 ? Math.round((totalSoldCap / totalCap) * 100) : 0;
                    return (
                    <tr className="total-row">
                      <td className="font-bold">Total</td>
                      <td className="text-right">{eventRevenues.reduce((s, e) => s + e.tickets, 0).toLocaleString()}</td>
                      <td className="text-right">{eventRevenues.reduce((s, e) => s + e.orders, 0).toLocaleString()}</td>
                      <td className="text-right font-bold">{fmtCurrency(eventRevenues.reduce((s, e) => s + e.revenue, 0))}</td>
                      <td className="text-right">{eventRevenues.reduce((s, e) => s + (e.refunded || 0), 0)}</td>
                      <td className="text-right font-bold">{fmtCurrency(eventRevenues.reduce((s, e) => s + e.revenue, 0) * 0.15)}</td>
                      <td className="text-right">{totalCap.toLocaleString()}</td>
                      <td className="text-right font-bold">{totalOcc}%</td>
                      <td></td>
                    </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Zone revenue info now lives inside drill-down per event — no more loose blocks/donut */}

          {/* Ingresos Diarios chart moved to Tendencias tab */}
        </div>
      )}

      {/* ====== CAPACIDAD TAB ====== */}
      {/* Capacidad tab REMOVED — capacity data now integrated into Ingresos table */}

      {/* ====== TENDENCIAS TAB ====== */}
      {activeTab === 'tendencias' && (
        <div className="space-y-4 animate-fade-in">
          {/* Ingresos Diarios + Ventas por Día side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {dailyRevenueData.length >= 2 && (
              <div className="section-card">
                <div className="section-card-header">
                  <span className="section-card-title">Ingresos Diarios</span>
                </div>
                <div className="section-card-body">
                  <div style={{ width: '100%', minWidth: 100, height: 180, minHeight: 180 }}>
                    <ResponsiveContainer width="99%" height={180}>
                      <BarChart data={dailyRevenueData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtAxisCurrency} width={45} />
                        <Tooltip formatter={(v) => [fmtCurrency(Number(v)), 'Ingresos']} />
                        <Bar dataKey="amount" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
            {dayOfWeekData.some(d => d.sales > 0) && (
              <div className="section-card">
                <div className="section-card-header">
                  <span className="section-card-title">Ventas por Día de la Semana</span>
                </div>
                <div className="section-card-body">
                  <div style={{ width: '100%', minWidth: 100, height: 180, minHeight: 180 }}>
                    <ResponsiveContainer width="99%" height={180}>
                      <BarChart data={dayOfWeekData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtAxisCurrency} width={45} />
                        <Tooltip formatter={(v) => [fmtCurrency(Number(v)), 'Ventas']} />
                        <Bar dataKey="sales" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Quick stats row — top */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase">Mejor día</p>
              <p className="text-xs sm:text-sm font-extrabold">{summaryStats.bestDay}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase">Ticket promedio</p>
              <p className="text-xs sm:text-sm font-extrabold">{fmtCurrency(summaryStats.avgTicketPrice)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase">Top evento</p>
              <p className="text-xs sm:text-sm font-extrabold truncate">{summaryStats.popularEvent}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase">Top zona</p>
              <p className="text-xs sm:text-sm font-extrabold">{summaryStats.popularZone}</p>
            </div>
          </div>

          {/* UTM Fuentes de Tráfico — full width */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Fuentes de Tráfico</span>
              <span className="ml-auto text-xs text-gray-400">{utmSources.length} fuentes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table text-xs">
                <thead>
                  <tr>
                    <th>Fuente</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Órdenes</th>
                    <th className="text-right hidden sm:table-cell">% del Total</th>
                  </tr>
                </thead>
                <tbody>
                  {utmSources.length > 0 ? (() => {
                    const totalUtmRev = utmSources.reduce((s, u) => s + u.revenue, 0);
                    return utmSources.map((s, i) => (
                      <tr key={i}>
                        <td className="font-bold">{s.source}</td>
                        <td className="text-right font-bold">{fmtCurrency(s.revenue)}</td>
                        <td className="text-right">{s.count}</td>
                        <td className="text-right hidden sm:table-cell">
                          <span className="text-gray-500">{totalUtmRev > 0 ? Math.round((s.revenue / totalUtmRev) * 100) : 0}%</span>
                        </td>
                      </tr>
                    ));
                  })() : (
                    <tr><td colSpan={4} className="text-center py-4 text-gray-400">Sin datos de UTM</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Geographic breakdown — compact */}
          {(() => {
            const geoFilteredOrders = selectedEvent ? rawOrders.filter(o => o.event_id === selectedEvent) : rawOrders;
            const geoMap = new Map<string, { count: number; revenue: number }>();
            geoFilteredOrders.forEach(o => {
              if (!o.city && !o.country) return; // skip unknown geo
              const key = `${o.city || '?'}, ${o.country || '?'}`;
              const existing = geoMap.get(key) || { count: 0, revenue: 0 };
              existing.count++;
              existing.revenue += o.total_price || 0;
              geoMap.set(key, existing);
            });
            const geoData = Array.from(geoMap.entries()).map(([loc, d]) => ({ loc, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
            if (geoData.length === 0) return null;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="section-card">
                  <div className="section-card-header">
                    <span className="section-card-title">Geografía</span>
                    <span className="ml-auto text-xs text-gray-400">{geoData.length} ubicaciones</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table text-xs">
                      <thead><tr><th>Ciudad, País</th><th className="text-right">Órdenes</th><th className="text-right">Revenue</th></tr></thead>
                      <tbody>
                        {geoData.map((g, i) => (
                          <tr key={i}><td className="font-bold">{g.loc}</td><td className="text-right">{g.count}</td><td className="text-right font-bold">{fmtCurrency(g.revenue)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="section-card">
                  <div className="section-card-header">
                    <span className="section-card-title">Dispositivos</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table text-xs">
                      <thead><tr><th>Dispositivo</th><th className="text-right">Órdenes</th><th className="text-right">%</th></tr></thead>
                      <tbody>
                        {deviceBreakdown.length > 0 ? deviceBreakdown.map((d, i) => {
                          const totalDev = deviceBreakdown.reduce((s, x) => s + x.count, 0);
                          return (
                            <tr key={i}><td className="font-bold capitalize">{d.device}</td><td className="text-right">{d.count}</td><td className="text-right text-gray-500">{totalDev > 0 ? Math.round((d.count / totalDev) * 100) : 0}%</td></tr>
                          );
                        }) : <tr><td colSpan={3} className="text-center py-3 text-gray-400">Sin datos</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Charts moved to top of Tendencias */}
        </div>
      )}

      {/* ====== TRANSACCIONES TAB ====== */}
      {activeTab === 'transacciones' && (
        <div className="space-y-3 animate-fade-in">
          {/* Search + count — compact row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por ticket, cliente, evento..."
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#EF4444] focus:border-[#EF4444]"
              />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">{processedTransactions.total} registros</span>
          </div>

          {/* Table with drill-down */}
          <div className="overflow-x-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th className="cursor-pointer" onClick={() => toggleSort('date')}>
                    <span className="inline-flex items-center gap-1">Fecha{txSort.col === 'date' && <span className={txSort.asc ? '' : 'rotate-180 inline-block'}>▲</span>}</span>
                  </th>
                  <th className="cursor-pointer" onClick={() => toggleSort('customer_name')}>Cliente</th>
                  <th className="cursor-pointer hidden sm:table-cell" onClick={() => toggleSort('event_name')}>Evento</th>
                  <th className="text-right cursor-pointer" onClick={() => toggleSort('amount')}>
                    <span className="inline-flex items-center gap-1 justify-end w-full">Monto{txSort.col === 'amount' && <span className={txSort.asc ? '' : 'rotate-180 inline-block'}>▲</span>}</span>
                  </th>
                  <th className="text-right hidden sm:table-cell" title="Boletos en esta transacción">Vendidos</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {processedTransactions.items.length > 0 ? processedTransactions.items.map((tx, i) => {
                  const txKey = `${tx.id}-${i}`;
                  const isExpTx = expandedTxId === txKey;
                  const txDate = new Date(tx.date);
                  const dayName = txDate.toLocaleDateString('es-MX', { weekday: 'long' });
                  const fullDate = txDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
                  const fullTime = txDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                  return (
                  <React.Fragment key={txKey}>
                  <tr onClick={() => setExpandedTxId(isExpTx ? null : txKey)} className={`cursor-pointer ${isExpTx ? 'bg-red-50' : ''}`}>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <svg className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isExpTx ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <span className="text-gray-600">{txDate.toLocaleString('es-MX', { day: 'numeric', month: 'short' })}</span>
                        <span className="text-gray-400 text-[10px]">{txDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td>
                      <div className="font-bold">{tx.customer_name || 'Anónimo'}</div>
                      <div className="text-gray-400 text-[10px]">{tx.customer_email || ''}</div>
                    </td>
                    <td className="hidden sm:table-cell text-gray-600">{tx.event_name}</td>
                    <td className="text-right font-extrabold">{fmtCurrency(tx.amount)}</td>
                    <td className="text-right hidden sm:table-cell text-gray-500">{tx.ticket_count || 1}</td>
                    <td>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
                        tx.status === 'Completado' ? 'bg-green-500' :
                        tx.status === 'Reembolsado' ? 'bg-red-500' :
                        tx.status === 'Usado' ? 'bg-blue-500' : 'bg-yellow-500'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                  {/* Drill-down detail */}
                  {isExpTx && (
                    <tr>
                      <td colSpan={6} className="bg-gray-50 p-0">
                        <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 text-xs">
                          <div><span className="text-gray-400 text-[10px] uppercase mr-1">Evento:</span><span className="font-bold">{tx.event_name}</span></div>
                          <div><span className="text-gray-400 text-[10px] uppercase mr-1">Zona:</span><span className="font-bold">{tx.zone_name || '—'}</span></div>
                          <div><span className="text-gray-400 text-[10px] uppercase mr-1">Día:</span><span className="font-bold capitalize">{dayName}, {fullDate}</span></div>
                          <div><span className="text-gray-400 text-[10px] uppercase mr-1">Hora:</span><span className="font-bold">{fullTime}</span></div>
                          <div><span className="text-gray-400 text-[10px] uppercase mr-1">ID:</span><span className="font-mono text-[10px] text-gray-500">{tx.id}</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                }) : (
                  <tr><td colSpan={6} className="text-center py-6 text-gray-400">No hay transacciones</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination — tight */}
          {processedTransactions.total > PER_PAGE && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {txPage * PER_PAGE + 1}–{Math.min((txPage + 1) * PER_PAGE, processedTransactions.total)} de {processedTransactions.total}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setTxPage(p => Math.max(0, p - 1))} disabled={txPage === 0}
                  className="px-3 py-1 text-xs border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
                <button onClick={() => setTxPage(p => p + 1)} disabled={(txPage + 1) * PER_PAGE >= processedTransactions.total}
                  className="px-3 py-1 text-xs border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50">Siguiente →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====== COMISIONES TAB ====== */}
      {activeTab === 'comisiones' && (
        <div className="space-y-4 animate-fade-in">
          {dispersions.length > 0 ? (() => {
            const filtDisp = selectedEvent ? dispersions.filter(d => d.event_id === selectedEvent) : dispersions;
            const totGross = filtDisp.reduce((s, d) => s + (d.gross_revenue || 0), 0);
            const totFee = filtDisp.reduce((s, d) => s + (d.platform_fee || 0), 0);
            const totPayout = filtDisp.reduce((s, d) => s + (d.net_payout || 0), 0);
            const totRefunds = filtDisp.reduce((s, d) => s + (d.refunds || 0), 0);
            const totAdSpend = filtDisp.reduce((s, d) => s + (d.ad_spend || 0), 0);
            return (<>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <div className="bg-white rounded-lg border border-gray-200 p-2 text-center">
                  <p className="text-[9px] text-gray-500 uppercase">Bruto</p>
                  <p className="text-sm font-extrabold">{fmtCurrency(totGross)}</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-2 text-center">
                  <p className="text-[9px] text-gray-500 uppercase">Comisión</p>
                  <p className="text-sm font-extrabold text-[#EF4444]">{fmtCurrency(totFee)}</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-2 text-center">
                  <p className="text-[9px] text-gray-500 uppercase">Payout</p>
                  <p className="text-sm font-extrabold text-emerald-600">{fmtCurrency(totPayout)}</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-2 text-center hidden sm:block">
                  <p className="text-[9px] text-gray-500 uppercase">Reembolsos</p>
                  <p className="text-sm font-extrabold text-orange-500">{fmtCurrency(totRefunds)}</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-2 text-center hidden sm:block">
                  <p className="text-[9px] text-gray-500 uppercase">Ad Spend</p>
                  <p className="text-sm font-extrabold text-blue-500">{fmtCurrency(totAdSpend)}</p>
                </div>
              </div>
              <div className="section-card">
                <div className="section-card-header">
                  <span className="section-card-title">Dispersiones</span>
                  <span className="ml-auto text-xs text-gray-400">{filtDisp.length} registros</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>Periodo</th>
                        <th className="text-right">Bruto</th>
                        <th className="text-right hidden sm:table-cell">Descuentos</th>
                        <th className="text-right hidden sm:table-cell">Reembolsos</th>
                        <th className="text-right">Comisión</th>
                        <th className="text-right">Net Payout</th>
                        <th>Estado</th>
                        <th className="hidden sm:table-cell">Ref. Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtDisp.map(d => (
                        <tr key={d.id}>
                          <td className="whitespace-nowrap">
                            {d.period_start ? new Date(d.period_start).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'}
                            {' – '}
                            {d.period_end ? new Date(d.period_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'}
                          </td>
                          <td className="text-right font-bold">{fmtCurrency(d.gross_revenue || 0)}</td>
                          <td className="text-right hidden sm:table-cell">{fmtCurrency(d.discounts || 0)}</td>
                          <td className="text-right hidden sm:table-cell">{fmtCurrency(d.refunds || 0)}</td>
                          <td className="text-right font-bold text-[#EF4444]">{fmtCurrency(d.platform_fee || 0)}</td>
                          <td className="text-right font-bold text-emerald-600">{fmtCurrency(d.net_payout || 0)}</td>
                          <td>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${d.status === 'paid' ? 'bg-green-500' : d.status === 'cancelled' ? 'bg-red-500' : 'bg-yellow-500'}`}>
                              {d.status === 'paid' ? 'Pagado' : d.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="hidden sm:table-cell text-gray-400 truncate max-w-[100px]">{d.payment_reference || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>);
          })() : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 text-center">
                  <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase">Ingresos brutos</p>
                  <p className="text-sm sm:text-lg font-extrabold">{fmtCurrency(commissionData.totalRevenue)}</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 text-center">
                  <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase">Comisión (15%)</p>
                  <p className="text-sm sm:text-lg font-extrabold text-[#EF4444]">{fmtCurrency(commissionData.dulosCommission)}</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 text-center">
                  <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase">Productor (85%)</p>
                  <p className="text-sm sm:text-lg font-extrabold text-emerald-600">{fmtCurrency(commissionData.producerShare)}</p>
                </div>
              </div>
              {/* Visual distribution bar */}
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex h-4 rounded-full overflow-hidden">
                  <div className="bg-[#EF4444] transition-all" style={{ width: '15%' }} />
                  <div className="bg-emerald-500 transition-all" style={{ width: '85%' }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] font-bold">
                  <span className="text-[#EF4444]">Dulos 15%</span>
                  <span className="text-emerald-600">Productor 85%</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Evento</th>
                      <th className="text-right" title="Total de boletos vendidos">Vendidos</th>
                      <th className="text-right">Ingresos</th>
                      <th className="text-right text-[#EF4444]">Dulos (15%)</th>
                      <th className="text-right text-emerald-600">Productor (85%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionData.events.map(event => (
                      <tr key={event.event_id}>
                        <td>
                          <div className="flex items-center gap-2">
                            {event.image_url && <img src={event.image_url} alt={event.event_name} className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                            <span className="font-bold">{event.event_name}</span>
                          </div>
                        </td>
                        <td className="text-right">{event.tickets.toLocaleString()}</td>
                        <td className="text-right font-bold">{fmtCurrency(event.revenue)}</td>
                        <td className="text-right font-bold text-[#EF4444]">{fmtCurrency(event.commission)}</td>
                        <td className="text-right font-bold text-emerald-600">{fmtCurrency(event.producer)}</td>
                      </tr>
                    ))}
                    {commissionData.events.length > 1 && (
                      <tr className="total-row">
                        <td className="font-bold">Total</td>
                        <td className="text-right">{commissionData.events.reduce((s, e) => s + e.tickets, 0).toLocaleString()}</td>
                        <td className="text-right font-bold">{fmtCurrency(commissionData.totalRevenue)}</td>
                        <td className="text-right font-bold">{fmtCurrency(commissionData.dulosCommission)}</td>
                        <td className="text-right font-bold">{fmtCurrency(commissionData.producerShare)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 text-center">⚠️ Cálculo estimado (15%). Las dispersiones reales aparecerán cuando se registren.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
