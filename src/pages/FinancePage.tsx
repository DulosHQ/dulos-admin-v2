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
  fetchTransactionHistory,
  fetchRevenueByEvent,
  DulosEvent,
  TicketZone,
  Ticket,
} from '../lib/supabase';

type TabKey = 'ingresos' | 'capacidad' | 'tendencias' | 'transacciones';

interface ScorecardData {
  revenue: number;
  revenuePrevious: number;
  aov: number;
  aovPrevious: number;
  completedOrders: number;
  completedOrdersPrevious: number;
  occupancyPercent: number;
  occupancyPercentPrevious: number;
}

interface ScheduleDisplay {
  name: string;
  date: string;
  capacity: number;
  sold: number;
  percentage: number;
}

interface DailyData {
  date: string;
  amount: number;
}

interface ZoneRevenue {
  zone: string;
  revenue: number;
  change: number;
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

const tabs: { key: TabKey; label: string }[] = [
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'capacidad', label: 'Capacidad' },
  { key: 'tendencias', label: 'Tendencias' },
  { key: 'transacciones', label: 'Transacciones' },
];

function SkeletonCard() {
  return (
    <div className="metric-card animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
    </div>
  );
}

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ingresos');
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string>(''); // '' means all events
  const [events, setEvents] = useState<DulosEvent[]>([]);
  const [zones, setZones] = useState<TicketZone[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [eventRevenues, setEventRevenues] = useState<{ event_id: string; event_name: string; revenue: number; image_url?: string }[]>([]);
  
  const [scorecardData, setScorecardData] = useState<ScorecardData>({
    revenue: 0,
    revenuePrevious: 0,
    aov: 0,
    aovPrevious: 0,
    completedOrders: 0,
    completedOrdersPrevious: 0,
    occupancyPercent: 0,
    occupancyPercentPrevious: 0,
  });
  
  const [schedules, setSchedules] = useState<ScheduleDisplay[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [zoneRevenues, setZoneRevenues] = useState<ZoneRevenue[]>([]);
  const [capacityStats, setCapacityStats] = useState({
    critical: 0,
    high: 0,
    normal: 0,
    totalCapacity: 0,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [zones, orders, schedulesData, eventsData, tickets, transactionHistory, revenueByEvent] = await Promise.all([
          fetchZones().catch(() => []),
          fetchAllOrders().catch(() => []),
          fetchSchedules().catch(() => []),
          fetchAllEvents().catch(() => []),
          fetchTickets().catch(() => []),
          fetchTransactionHistory().catch(() => []),
          fetchRevenueByEvent().catch(() => []),
        ]);

        setEvents(eventsData);
        setEventRevenues(revenueByEvent);

        // Filter data by selected event if one is selected
        const filteredZones = selectedEvent ? zones.filter(z => z.event_id === selectedEvent) : zones;
        const filteredOrders = selectedEvent ? orders.filter(o => o.event_id === selectedEvent) : orders;
        const filteredSchedules = selectedEvent ? schedulesData.filter(s => s.event_id === selectedEvent) : schedulesData;
        const filteredTickets = selectedEvent ? tickets.filter(t => t.event_id === selectedEvent) : tickets;

        // Create event lookup
        const eventMap = new Map(eventsData.map((e) => [e.id, e]));

        // Transform transaction history
        const transactionList: Transaction[] = filteredTickets.map((ticket) => {
          const event = eventMap.get(ticket.event_id);
          return {
            id: ticket.ticket_number,
            customer_name: ticket.customer_name,
            customer_email: ticket.customer_email,
            event_name: event?.name || ticket.event_id,
            zone_name: ticket.zone_name,
            amount: 0, // Amount would need to be calculated from zones
            date: ticket.created_at,
            status: ticket.status === 'valid' ? 'Completado' : ticket.status === 'used' ? 'Usado' : 'Pendiente'
          };
        }).slice(0, 100); // Limit to latest 100

        setTransactions(transactionList);

        // Calculate revenue from zones (sold * price)
        const totalRevenue = filteredZones.reduce((sum, z) => sum + (z.sold * z.price), 0);
        const totalSold = filteredZones.reduce((sum, z) => sum + z.sold, 0);
        const totalAvailable = filteredZones.reduce((sum, z) => sum + z.available + z.sold, 0);
        const occupancyPercent = totalAvailable > 0 ? (totalSold / totalAvailable) * 100 : 0;

        // Calculate completed orders
        const completedOrders = filteredOrders.filter((o) => o.payment_status === 'paid' || o.payment_status === 'completed').length;
        const aov = completedOrders > 0 ? totalRevenue / completedOrders : totalSold > 0 ? totalRevenue / totalSold : 0;

        setScorecardData({
          revenue: totalRevenue,
          revenuePrevious: totalRevenue || 1,
          aov,
          aovPrevious: aov || 1,
          completedOrders: completedOrders || totalSold,
          completedOrdersPrevious: completedOrders || totalSold || 1,
          occupancyPercent,
          occupancyPercentPrevious: occupancyPercent || 1,
        });

        // Group zones by zone_name for revenue breakdown
        const zoneRevenueMap = new Map<string, number>();
        filteredZones.forEach((z) => {
          const current = zoneRevenueMap.get(z.zone_name) || 0;
          zoneRevenueMap.set(z.zone_name, current + (z.sold * z.price));
        });

        const zoneRevenueArray: ZoneRevenue[] = Array.from(zoneRevenueMap.entries())
          .map(([zone, revenue]) => ({
            zone,
            revenue,
            change: 0,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 3);

        setZoneRevenues(zoneRevenueArray);

        // Build schedules for capacity view
        const schedulesDisplay: ScheduleDisplay[] = filteredSchedules.map((s) => {
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
          };
        }).sort((a, b) => b.percentage - a.percentage);

        setSchedules(schedulesDisplay);

        // Calculate capacity stats
        const critical = schedulesDisplay.filter((s) => s.percentage > 80).length;
        const high = schedulesDisplay.filter((s) => s.percentage >= 50 && s.percentage <= 80).length;
        const normal = schedulesDisplay.filter((s) => s.percentage < 50).length;
        const totalCapacity = schedulesDisplay.reduce((sum, s) => sum + s.capacity, 0);

        setCapacityStats({ critical, high, normal, totalCapacity });

        // Build daily data from orders (last 7 days)
        const now = new Date();
        const dailyMap = new Map<string, number>();

        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          dailyMap.set(dateStr, 0);
        }

        // Sum up orders by date
        filteredOrders.forEach((order) => {
          if (order.purchased_at) {
            const dateStr = order.purchased_at.split('T')[0];
            if (dailyMap.has(dateStr)) {
              dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + order.total_price);
            }
          }
        });

        const dailyArray = Array.from(dailyMap.entries()).map(([date, amount]) => ({
          date,
          amount,
        }));

        setDailyData(dailyArray);
        setLoading(false);
      } catch (error) {
        console.error('Error loading finance data:', error);
        setLoading(false);
      }
    }

    loadData();
  }, [selectedEvent]); // Reload when event filter changes

  const exportCSV = () => {
    const rows = [
      ['Metrica', 'Valor Actual', 'Valor Anterior', 'Cambio %'],
      ['Ingresos', scorecardData.revenue.toString(), scorecardData.revenuePrevious.toString(), `${((scorecardData.revenue - scorecardData.revenuePrevious) / scorecardData.revenuePrevious * 100).toFixed(1)}%`],
      ['AOV', scorecardData.aov.toFixed(0), scorecardData.aovPrevious.toFixed(0), `${((scorecardData.aov - scorecardData.aovPrevious) / scorecardData.aovPrevious * 100).toFixed(1)}%`],
      ['Ordenes Completadas', scorecardData.completedOrders.toString(), scorecardData.completedOrdersPrevious.toString(), `${((scorecardData.completedOrders - scorecardData.completedOrdersPrevious) / scorecardData.completedOrdersPrevious * 100).toFixed(1)}%`],
      ['Ocupacion %', scorecardData.occupancyPercent.toFixed(1), scorecardData.occupancyPercentPrevious.toFixed(1), `${(scorecardData.occupancyPercent - scorecardData.occupancyPercentPrevious).toFixed(1)}%`],
      ...zoneRevenues.map((z) => [z.zone, z.revenue.toString(), '-', '-']),
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header with Event Filter and Export */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Panel Financiero</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Metricas de ingresos, capacidad y tendencias
          </p>
        </div>
        <div className="flex gap-3">
          {/* Event Filter Dropdown */}
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#E63946] focus:border-[#E63946]"
          >
            <option value="">Todos los Eventos</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-[#E63946] text-white rounded-lg text-sm font-medium hover:bg-[#c5303c] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="section-card">
        <div className="flex gap-6 px-5 border-b border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative py-4 text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'text-[#E63946]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E63946]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'ingresos' && (
        <div className="space-y-4">
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
                {eventRevenues.length > 0 ? eventRevenues.slice(0, 6).map((event) => (
                  <div key={event.event_id} className="p-3 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      {event.image_url && (
                        <img 
                          src={event.image_url} 
                          alt={event.event_name} 
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-sm text-gray-900">{event.event_name}</p>
                        <p className="text-lg font-extrabold text-[#E63946]">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(event.revenue)}
                        </p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-3 text-center text-gray-500 py-4 text-sm">
                    No hay datos de eventos disponibles
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="section-card-title">Resumen de Ingresos por Zona</span>
            </div>
            <div className="section-card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {zoneRevenues.length > 0 ? zoneRevenues.map((z) => (
                  <div key={z.zone} className="metric-card">
                    <p className="metric-card-title">{z.zone}</p>
                    <p className="metric-card-value">
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(z.revenue)}
                    </p>
                    <p className="metric-card-subtitle text-gray-400">
                      Ingresos acumulados
                    </p>
                  </div>
                )) : (
                  <div className="col-span-3 text-center text-gray-500 py-4 text-sm">
                    No hay datos de zonas disponibles
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transacciones' && (
        <div className="section-card">
          <div className="section-card-header">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="section-card-title">Historial de Transacciones</span>
            <span className="ml-auto text-sm text-gray-500">{transactions.length} registros</span>
          </div>
          <div className="section-card-body p-0">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 font-bold text-gray-600 text-[13px]">Ticket</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-600 text-[13px]">Cliente</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-600 text-[13px]">Evento</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-600 text-[13px]">Zona</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-600 text-[13px]">Fecha</th>
                    <th className="text-center py-2 px-3 font-bold text-gray-600 text-[13px]">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length > 0 ? transactions.map((transaction, index) => (
                    <tr key={transaction.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-1.5 px-3 text-[13px] font-mono text-[#E63946] font-bold">{transaction.id}</td>
                      <td className="py-1.5 px-3 text-[13px]">
                        <div>
                          <div className="font-bold">{transaction.customer_name}</div>
                          <div className="text-gray-500 text-xs">{transaction.customer_email}</div>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-[13px] text-gray-600">{transaction.event_name}</td>
                      <td className="py-1.5 px-3 text-[13px] text-gray-600">{transaction.zone_name}</td>
                      <td className="py-1.5 px-3 text-[13px] text-gray-500">
                        {new Date(transaction.date).toLocaleString('es-MX', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white ${
                          transaction.status === 'Completado' ? 'bg-green-500' :
                          transaction.status === 'Usado' ? 'bg-blue-500' : 'bg-yellow-500'
                        }`}>
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500 text-sm">
                        No hay transacciones disponibles
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'capacidad' && (
        <div className="space-y-4">
          <div className="section-card">
            <div className="section-card-header">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="section-card-title">Ocupación por Función</span>
              <div className="flex gap-4 text-xs ml-auto">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  Crítico (&gt;80%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                  Alto (50-80%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  Normal (&lt;50%)
                </span>
              </div>
            </div>
          </div>

          <CapacityBars schedules={schedules} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="metric-card">
              <p className="metric-card-title">Eventos Críticos</p>
              <p className="metric-card-value text-red-500">{capacityStats.critical}</p>
              <p className="metric-card-subtitle">Ocupación &gt;80%</p>
              <div className="metric-card-icon bg-red-100">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="metric-card">
              <p className="metric-card-title">Ocupación Alta</p>
              <p className="metric-card-value text-amber-500">{capacityStats.high}</p>
              <p className="metric-card-subtitle">Entre 50-80%</p>
              <div className="metric-card-icon bg-amber-100">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="metric-card">
              <p className="metric-card-title">Ocupación Normal</p>
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

      {activeTab === 'tendencias' && (
        <div className="space-y-4">
          <SalesTrend dailyData={dailyData} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="section-card">
              <div className="section-card-header">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="section-card-title">Mejores Días de Venta</span>
              </div>
              <div className="section-card-body">
                <div className="space-y-3">
                  {[...dailyData]
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 3)
                    .map((day, index) => (
                      <div
                        key={day.date}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-extrabold text-sm ${
                              index === 0
                                ? 'bg-[#E63946]'
                                : index === 1
                                ? 'bg-gray-400'
                                : 'bg-amber-600'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <span className="font-bold text-gray-900 text-sm">
                            {new Intl.DateTimeFormat('es-MX', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'short',
                            }).format(new Date(day.date))}
                          </span>
                        </div>
                        <span className="font-extrabold text-gray-900">
                          {new Intl.NumberFormat('es-MX', {
                            style: 'currency',
                            currency: 'MXN',
                            minimumFractionDigits: 0,
                          }).format(day.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-card-header">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="section-card-title">Proyección Semanal</span>
              </div>
              <div className="section-card-body space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-gray-500">Meta semanal</p>
                    <p className="text-2xl font-extrabold text-gray-900">
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(scorecardData.revenue * 1.1)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Alcanzado</p>
                    <p className="text-2xl font-extrabold text-[#E63946]">
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(scorecardData.revenue)}
                    </p>
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#E63946] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(90.9, 100)}%` }}
                  />
                </div>
                <p className="text-center text-sm text-gray-600">
                  <span className="font-extrabold text-[#E63946]">90.9%</span> de la meta alcanzada
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}