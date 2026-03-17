'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import FinanceScorecard from '../components/FinanceScorecard';
import CapacityBars from '../components/CapacityBars';
import {
  fetchZones,
  fetchAllOrders,
  fetchSchedules,
  fetchAllEvents,
  fetchTickets,
  fetchRevenueByEvent,
  fetchSalesSummary,
  DulosEvent,
  TicketZone,
  Ticket,
  Schedule,
  SalesSummary,
} from '../lib/supabase';

type TabKey = 'ingresos' | 'capacidad' | 'tendencias' | 'transacciones' | 'comisiones';
type DateRange = '7d' | '30d' | '90d' | 'all';

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
}

interface ZoneRevenue {
  zone: string;
  revenue: number;
}

const tabs: { key: TabKey; label: string }[] = [
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'capacidad', label: 'Capacidad' },
  { key: 'tendencias', label: 'Tendencias' },
  { key: 'transacciones', label: 'Transacciones' },
  { key: 'comisiones', label: 'Comisiones' },
];

const dateRangeOptions: { key: DateRange; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'Todo' },
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
    setSelectedEvent('');
    setDateRange('all');
    setFiltersApplied(false);
    setTxPage(0);
  };

  const hasFilterChanges = pendingEvent !== selectedEvent || pendingDateRange !== dateRange;

  // Raw data
  const [events, setEvents] = useState<DulosEvent[]>([]);
  const [rawZones, setRawZones] = useState<TicketZone[]>([]);
  const [rawTickets, setRawTickets] = useState<Ticket[]>([]);
  const [rawSchedules, setRawSchedules] = useState<Schedule[]>([]);
  const [rawEventRevenues, setRawEventRevenues] = useState<{ event_id: string; event_name: string; revenue: number; image_url?: string }[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary[]>([]);
  const [pedidosData] = useState<{ headers: string[]; rows: any[]; totalRows: number }>({ headers: [], rows: [], totalRows: 0 });

  // UI state
  const [expandedCapacity, setExpandedCapacity] = useState<number | null>(null);
  const [txSearch, setTxSearch] = useState('');
  const [txSort, setTxSort] = useState<{ col: keyof Transaction; asc: boolean }>({ col: 'date', asc: false });
  const [txPage, setTxPage] = useState(0);

  // Fetch all data once
  useEffect(() => {
    async function loadData() {
      try {
        const [zones, _orders, schedulesData, eventsData, tickets, revenueByEvent, salesSummaryData] = await Promise.all([
          fetchZones().catch(() => [] as TicketZone[]),
          fetchAllOrders().catch(() => []),
          fetchSchedules().catch(() => [] as Schedule[]),
          fetchAllEvents().catch(() => [] as DulosEvent[]),
          fetchTickets().catch(() => [] as Ticket[]),
          fetchRevenueByEvent().catch(() => []),
          fetchSalesSummary().catch(() => [] as SalesSummary[]),
        ]);
        setRawZones(zones);
        setRawTickets(tickets);
        setRawSchedules(schedulesData);
        setEvents(eventsData);
        setRawEventRevenues(revenueByEvent);
        setSalesSummary(salesSummaryData);
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
    if (dateRange !== 'all') {
      cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90));
    }

    // Filter zones & tickets by event
    const filteredZones = selectedEvent ? rawZones.filter(z => z.event_id === selectedEvent) : rawZones;
    const eventFilteredTickets = selectedEvent ? rawTickets.filter(t => t.event_id === selectedEvent) : rawTickets;

    // Filter tickets by date
    const filteredTickets = cutoff
      ? eventFilteredTickets.filter(t => new Date(t.created_at) >= cutoff!)
      : eventFilteredTickets;

    // Filter schedules by event
    const filteredSchedules = selectedEvent ? rawSchedules.filter(s => s.event_id === selectedEvent) : rawSchedules;

    // Event revenues from sales summary (REAL DATA)
    const eventRevenues = filteredSalesSummary.map(s => ({
      event_id: s.event_id,
      event_name: s.event_name,
      revenue: s.total_revenue,
      orders: s.total_orders,
      tickets: s.total_tickets_sold,
      image_url: eventMap.get(s.event_id)?.image_url
    })).sort((a, b) => b.revenue - a.revenue);

    // --- Scorecard using Sales Summary (REAL DATA) ---

    // Use real revenue from v_sales_summary
    const totalRevenue = filteredSalesSummary.reduce((sum, s) => sum + s.total_revenue, 0);
    const totalOrders = filteredSalesSummary.reduce((sum, s) => sum + s.total_orders, 0);
    const totalTicketsSold = filteredSalesSummary.reduce((sum, s) => sum + s.total_tickets_sold, 0);

    // Keep zone-based calculations for occupancy (as per requirements)
    const totalSold = filteredZones.reduce((sum, z) => sum + z.sold, 0);
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

    // --- Zone revenues ---
    const zoneRevenueMap = new Map<string, number>();
    filteredZones.forEach(z => {
      zoneRevenueMap.set(z.zone_name, (zoneRevenueMap.get(z.zone_name) || 0) + z.sold * z.price);
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
    const transactions: Transaction[] = filteredTickets.map(ticket => {
      const event = eventMap.get(ticket.event_id);
      const price = zonePriceMap.get(`${ticket.event_id}:${ticket.zone_name}`) || 0;
      return {
        id: ticket.ticket_number,
        customer_name: ticket.customer_name,
        customer_email: ticket.customer_email,
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

    // --- Commission calculations (10% for Dulos, 90% for producers) ---
    const totalComissionRevenue = filteredSalesSummary.reduce((sum, s) => sum + s.total_revenue, 0);
    const dulosCommission = totalComissionRevenue * 0.10;
    const producerShare = totalComissionRevenue * 0.90;

    const commissionData = {
      totalRevenue: totalComissionRevenue,
      dulosCommission,
      producerShare,
      events: filteredSalesSummary.map(s => ({
        event_id: s.event_id,
        event_name: s.event_name,
        revenue: s.total_revenue,
        commission: s.total_revenue * 0.10,
        producer: s.total_revenue * 0.90,
        tickets: s.total_tickets_sold,
        image_url: eventMap.get(s.event_id)?.image_url
      })).sort((a, b) => b.revenue - a.revenue)
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

        transactionsFromPedidos.push({
          id: String(id),
          customer_name: customerName || 'N/A',
          customer_email: customerEmail || 'N/A',
          event_name: String(evento),
          zone_name: 'General', // Default zone since pedidos doesn't have zone info
          amount,
          date: fecha,
          status: 'Completado'
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
    };
  }, [loading, events, rawZones, rawTickets, rawSchedules, rawEventRevenues, salesSummary, pedidosData, selectedEvent, dateRange]);

  // Reset txPage when filters change
  useEffect(() => { setTxPage(0); }, [selectedEvent, dateRange, txSearch, txSort]);

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

  const SortHeader = ({ col, label }: { col: keyof Transaction; label: string }) => (
    <th
      className="text-left py-3 px-2 sm:px-3 font-bold text-white text-[11px] sm:text-[13px] cursor-pointer select-none hover:text-gray-300 transition-colors whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
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

  const { scorecardData, eventRevenues, zoneRevenues, donutData, donutTotal, dailyRevenueData, schedulesDisplay, zonesByEvent, capacityStats, dayOfWeekData, eventOccupancy, summaryStats, commissionData } = computed;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">Panel Financiero</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Metricas de ingresos, capacidad y tendencias</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date range presets — pending until "Aplicar" */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {dateRangeOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setPendingDateRange(opt.key)}
                className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                  pendingDateRange === opt.key
                    ? 'bg-[#1E293B] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Event dropdown — pending until "Aplicar" */}
          <select
            value={pendingEvent}
            onChange={e => setPendingEvent(e.target.value)}
            className="px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#EF4444] focus:border-[#EF4444]"
          >
            <option value="">Todos los Eventos</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>

          {/* Aplicar / Limpiar buttons */}
          <button
            onClick={applyFilters}
            disabled={!hasFilterChanges}
            className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
              hasFilterChanges
                ? 'bg-[#EF4444] text-white hover:bg-[#c5303c]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Aplicar Filtros
          </button>
          {filtersApplied && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Limpiar
            </button>
          )}

          {/* Export */}
          <button
            onClick={exportCSV}
            className="px-3 sm:px-4 py-2 bg-[#EF4444] text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-[#c5303c] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
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
          <FinanceScorecard data={scorecardData} currency="MXN" />

          {/* Revenue by Event Cards */}
          <div className="section-card">
            <div className="section-card-header">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="section-card-title">Ingresos por Evento</span>
            </div>
            <div className="section-card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {eventRevenues.length > 0 ? eventRevenues.slice(0, 6).map(event => (
                  <div key={event.event_id} className="p-3 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      {event.image_url && (
                        <img src={event.image_url} alt={event.event_name} className="w-12 h-12 rounded-lg object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900 truncate">{event.event_name}</p>
                        <p className="text-base sm:text-lg font-extrabold text-[#EF4444]">{fmtCurrency(event.revenue)}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full text-center text-gray-500 py-4 text-sm">No hay datos de eventos disponibles</div>
                )}
              </div>
            </div>
          </div>

          {/* Resumen por Zona + Donut — compact row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-1">
            {zoneRevenues.length > 0 ? zoneRevenues.slice(0, 3).map(z => (
              <div key={z.zone} className="flex-1 p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[11px] font-bold text-gray-500 uppercase">{z.zone}</p>
                <p className="text-base font-extrabold text-gray-900">{fmtCurrency(z.revenue)}</p>
              </div>
            )) : (
              <div className="flex-1 text-center text-gray-500 py-2 text-sm">No hay datos de zonas</div>
            )}
            {donutData.length > 0 && (
              <div className="flex-shrink-0 flex items-center gap-2 justify-center sm:justify-start">
                <div className="relative">
                  <PieChart width={120} height={120}>
                    <Pie
                      data={donutData}
                      cx={60}
                      cy={60}
                      innerRadius={35}
                      outerRadius={52}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                  </PieChart>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-gray-700">{fmtCurrency(donutTotal)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {donutData.map(d => (
                    <span key={d.name} className="flex items-center gap-1 text-[11px] text-gray-600">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Daily Revenue Area Chart */}
          {dailyRevenueData.length >= 3 && (
            <div className="section-card">
              <div className="section-card-header">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <span className="section-card-title">Ingresos Diarios</span>
              </div>
              <div className="section-card-body">
                <div style={{ width: '100%', minHeight: 200 }}>
                  <ResponsiveContainer width="100%" height={200} minWidth={50} minHeight={150}>
                    <AreaChart data={dailyRevenueData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={fmtAxisCurrency} width={50} />
                      <Tooltip formatter={(v) => [fmtCurrency(Number(v)), 'Ingresos']} />
                      <Area type="monotone" dataKey="amount" stroke="#EF4444" fill="url(#revenueGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====== CAPACIDAD TAB ====== */}
      {activeTab === 'capacidad' && (
        <div className="space-y-4 animate-fade-in">
          <div className="section-card">
            <div className="section-card-header flex-wrap gap-2">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="section-card-title">Ocupacion por Funcion</span>
              <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs ml-auto">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500" />Critico
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-500" />Alto
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500" />Normal
                </span>
              </div>
            </div>
          </div>

          <CapacityBars
            schedules={schedulesDisplay}
            zonesByEvent={zonesByEvent}
            expandedIndex={expandedCapacity}
            onToggle={(index) => setExpandedCapacity(prev => prev === index ? null : index)}
          />

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <div className="metric-card">
              <p className="metric-card-title">Eventos Criticos</p>
              <p className="metric-card-value text-red-500">{capacityStats.critical}</p>
              <p className="metric-card-subtitle">Ocupacion &gt;80%</p>
              <div className="metric-card-icon bg-red-100">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="metric-card">
              <p className="metric-card-title">Ocupacion Alta</p>
              <p className="metric-card-value text-amber-500">{capacityStats.high}</p>
              <p className="metric-card-subtitle">Entre 50-80%</p>
              <div className="metric-card-icon bg-amber-100">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="metric-card">
              <p className="metric-card-title">Ocupacion Normal</p>
              <p className="metric-card-value text-emerald-500">{capacityStats.normal}</p>
              <p className="metric-card-subtitle">&lt;50% ocupado</p>
              <div className="metric-card-icon bg-emerald-100">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="metric-card">
              <p className="metric-card-title">Capacidad Total</p>
              <p className="metric-card-value">{capacityStats.totalCapacity.toLocaleString()}</p>
              <p className="metric-card-subtitle">Asientos disponibles</p>
              <div className="metric-card-icon bg-gray-100">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== TENDENCIAS TAB ====== */}
      {activeTab === 'tendencias' && (
        <div className="space-y-4 animate-fade-in">
          {/* Two charts side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sales by day of week */}
            <div className="section-card">
              <div className="section-card-header">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="section-card-title">Ventas por Dia de la Semana</span>
              </div>
              <div className="section-card-body">
                <div style={{ width: '100%', minHeight: 250 }}>
                  <ResponsiveContainer width="100%" height={250} minWidth={50} minHeight={200}>
                    <BarChart data={dayOfWeekData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={fmtAxisCurrency} width={50} />
                      <Tooltip formatter={(v) => [fmtCurrency(Number(v)), 'Ventas']} />
                      <Bar dataKey="sales" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Occupancy by event */}
            <div className="section-card">
              <div className="section-card-header">
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="section-card-title">Ocupacion Promedio por Evento</span>
              </div>
              <div className="section-card-body">
                {eventOccupancy.length > 0 ? (
                  <div className="space-y-3">
                    {eventOccupancy.map((ev, i) => {
                      const barColor = ev.occupancy > 80 ? 'bg-[#EF4444]' : ev.occupancy >= 50 ? 'bg-yellow-500' : 'bg-green-500';
                      return (
                        <div key={i} className="flex items-center gap-2 sm:gap-3">
                          {ev.image_url ? (
                            <img src={ev.image_url} alt={ev.name} className="w-6 h-6 rounded object-cover flex-shrink-0 hidden sm:block" />
                          ) : (
                            <div className="w-6 h-6 rounded bg-gray-200 flex-shrink-0 hidden sm:block" />
                          )}
                          <span className="text-xs sm:text-sm text-gray-700 w-24 sm:w-36 truncate flex-shrink-0">{ev.name}</span>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(ev.occupancy, 100)}%` }} />
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-gray-900 w-10 sm:w-12 text-right">{ev.occupancy}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 text-sm py-4">No hay datos disponibles</p>
                )}
              </div>
            </div>
          </div>

          {/* Summary card */}
          <div className="section-card">
            <div className="section-card-header">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span className="section-card-title">Resumen</span>
            </div>
            <div className="section-card-body">
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500">Mejor dia de venta</p>
                  <p className="text-base sm:text-lg font-extrabold text-gray-900">{summaryStats.bestDay}</p>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500">Precio promedio</p>
                  <p className="text-base sm:text-lg font-extrabold text-gray-900">{fmtCurrency(summaryStats.avgTicketPrice)}</p>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500">Evento mas popular</p>
                  <p className="text-base sm:text-lg font-extrabold text-gray-900 truncate">{summaryStats.popularEvent}</p>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-500">Zona mas popular</p>
                  <p className="text-base sm:text-lg font-extrabold text-gray-900">{summaryStats.popularZone}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== TRANSACCIONES TAB ====== */}
      {activeTab === 'transacciones' && (
        <div className="section-card animate-fade-in">
          <div className="section-card-header">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="section-card-title">Historial de Transacciones</span>
            <span className="ml-auto text-xs sm:text-sm text-gray-500">{processedTransactions.total} registros</span>
          </div>

          {/* Search bar */}
          <div className="px-3 sm:px-5 py-3 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por ticket, cliente, evento..."
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#EF4444] focus:border-[#EF4444]"
              />
            </div>
          </div>

          <div className="section-card-body p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#1E293B]">
                  <tr>
                    <SortHeader col="id" label="ID" />
                    <SortHeader col="date" label="Fecha" />
                    <SortHeader col="customer_name" label="Cliente" />
                    <th className="text-left py-3 px-2 sm:px-3 font-bold text-white text-[11px] sm:text-[13px] cursor-pointer select-none hover:text-gray-300 transition-colors whitespace-nowrap hidden md:table-cell" onClick={() => toggleSort('event_name')}>
                      <span className="inline-flex items-center gap-1">Evento{txSort.col === 'event_name' && <svg className={`w-3 h-3 transition-transform ${txSort.asc ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>}</span>
                    </th>
                    <th className="text-left py-3 px-2 sm:px-3 font-bold text-white text-[11px] sm:text-[13px] cursor-pointer select-none hover:text-gray-300 transition-colors whitespace-nowrap hidden lg:table-cell" onClick={() => toggleSort('zone_name')}>
                      <span className="inline-flex items-center gap-1">Zona{txSort.col === 'zone_name' && <svg className={`w-3 h-3 transition-transform ${txSort.asc ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>}</span>
                    </th>
                    <SortHeader col="amount" label="Monto" />
                    <SortHeader col="status" label="Estado" />
                  </tr>
                </thead>
                <tbody>
                  {processedTransactions.items.length > 0 ? processedTransactions.items.map(tx => (
                    <tr key={tx.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2 sm:px-3 text-[11px] sm:text-[13px] font-mono text-[#EF4444] font-bold">{tx.id}</td>
                      <td className="py-2 px-2 sm:px-3 text-[11px] sm:text-[13px] text-gray-500 whitespace-nowrap">
                        {new Date(tx.date).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-2 sm:px-3 text-[11px] sm:text-[13px]">
                        <div className="font-bold truncate max-w-[100px] sm:max-w-none">{tx.customer_name}</div>
                        <div className="text-gray-500 text-[10px] sm:text-xs truncate max-w-[100px] sm:max-w-none">{tx.customer_email}</div>
                      </td>
                      <td className="py-2 px-2 sm:px-3 text-[11px] sm:text-[13px] text-gray-600 hidden md:table-cell">{tx.event_name}</td>
                      <td className="py-2 px-2 sm:px-3 text-[11px] sm:text-[13px] text-gray-600 hidden lg:table-cell">{tx.zone_name}</td>
                      <td className="py-2 px-2 sm:px-3 text-[11px] sm:text-[13px] font-bold text-gray-900">{fmtCurrency(tx.amount)}</td>
                      <td className="py-2 px-2 sm:px-3 text-center">
                        <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-white ${
                          tx.status === 'Completado' ? 'bg-green-500' :
                          tx.status === 'Reembolsado' ? 'bg-red-500' :
                          tx.status === 'Usado' ? 'bg-blue-500' : 'bg-yellow-500'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500 text-sm">No hay transacciones disponibles</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {processedTransactions.total > PER_PAGE && (
              <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-gray-100">
                <span className="text-xs sm:text-sm text-gray-500">
                  {txPage * PER_PAGE + 1}-{Math.min((txPage + 1) * PER_PAGE, processedTransactions.total)} de {processedTransactions.total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTxPage(p => Math.max(0, p - 1))}
                    disabled={txPage === 0}
                    className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setTxPage(p => p + 1)}
                    disabled={(txPage + 1) * PER_PAGE >= processedTransactions.total}
                    className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== COMISIONES TAB ====== */}
      {activeTab === 'comisiones' && (
        <div className="space-y-4 animate-fade-in">
          {/* Commission Summary Card */}
          <div className="section-card">
            <div className="section-card-header">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="section-card-title">Resumen de Comisiones</span>
            </div>
            <div className="section-card-body">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="metric-card">
                  <p className="metric-card-title">Total Ingresos</p>
                  <p className="metric-card-value">{fmtCurrency(commissionData.totalRevenue)}</p>
                  <p className="metric-card-subtitle">Ingresos totales</p>
                  <div className="metric-card-icon bg-blue-100">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="metric-card">
                  <p className="metric-card-title">Comisión Dulos (10%)</p>
                  <p className="metric-card-value text-[#EF4444]">{fmtCurrency(commissionData.dulosCommission)}</p>
                  <p className="metric-card-subtitle">Para Dulos</p>
                  <div className="metric-card-icon bg-red-100">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div className="metric-card">
                  <p className="metric-card-title">Para Productor (90%)</p>
                  <p className="metric-card-value text-emerald-600">{fmtCurrency(commissionData.producerShare)}</p>
                  <p className="metric-card-subtitle">Para productores</p>
                  <div className="metric-card-icon bg-emerald-100">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Commission Breakdown Table */}
          <div className="section-card">
            <div className="section-card-header">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="section-card-title">Desglose por Evento</span>
              <span className="ml-auto text-xs sm:text-sm text-gray-500">{commissionData.events.length} eventos</span>
            </div>
            <div className="section-card-body p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#1E293B]">
                    <tr>
                      <th className="text-left py-3 px-2 sm:px-3 font-bold text-white text-[11px] sm:text-[13px] whitespace-nowrap">Evento</th>
                      <th className="text-left py-3 px-2 sm:px-3 font-bold text-white text-[11px] sm:text-[13px] whitespace-nowrap">Ingresos</th>
                      <th className="text-left py-3 px-2 sm:px-3 font-bold text-white text-[11px] sm:text-[13px] whitespace-nowrap">Comisión (10%)</th>
                      <th className="text-left py-3 px-2 sm:px-3 font-bold text-white text-[11px] sm:text-[13px] whitespace-nowrap">Productor (90%)</th>
                      <th className="text-left py-3 px-2 sm:px-3 font-bold text-white text-[11px] sm:text-[13px] whitespace-nowrap">Boletos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionData.events.length > 0 ? commissionData.events.map(event => (
                      <tr key={event.event_id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 sm:px-3 text-[11px] sm:text-[13px]">
                          <div className="flex items-center gap-2">
                            {event.image_url && (
                              <img src={event.image_url} alt={event.event_name} className="w-8 h-8 rounded object-cover" />
                            )}
                            <span className="font-bold">{event.event_name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 sm:px-3 text-[11px] sm:text-[13px] font-bold text-gray-900">{fmtCurrency(event.revenue)}</td>
                        <td className="py-2 px-2 sm:px-3 text-[11px] sm:text-[13px] font-bold text-[#EF4444]">{fmtCurrency(event.commission)}</td>
                        <td className="py-2 px-2 sm:px-3 text-[11px] sm:text-[13px] font-bold text-emerald-600">{fmtCurrency(event.producer)}</td>
                        <td className="py-2 px-2 sm:px-3 text-[11px] sm:text-[13px] text-gray-600">{event.tickets.toLocaleString()}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">No hay datos de comisiones disponibles</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
