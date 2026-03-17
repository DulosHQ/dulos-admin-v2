'use client';

import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import HeroMetrics from '../components/HeroMetrics';
import {
  fetchEvents,
  fetchZones,
  fetchOrders,
  fetchCheckins,
  fetchEscalations,
  fetchTickets,
  fetchSchedules,
  fetchSalesSummary,
  getVenueMap,
  getVenueName,
  getVenueCity,
  DulosEvent,
  TicketZone,
  Order,
  Checkin,
  Escalation,
  Ticket,
  Schedule,
  Venue,
  SalesSummary,
} from '../lib/supabase';

interface Alerta {
  id: number | string;
  tipo: 'critico' | 'warning' | 'info';
  mensaje: string;
  eventName: string;
  imageUrl: string;
  issue: string;
  suggestion: string;
}

interface Actividad {
  id: string;
  tipo: string;
  mensaje: string;
  tiempo: string;
  monto?: number;
}

interface FuncionProxima {
  id: number;
  eventId: string;
  nombre: string;
  hora: string;
  sala: string;
  ocupacion: number;
  available: number;
  image_url: string;
  revenue: number;
  orders: number;
  ticketsSold: number;
}

interface ZoneDetail {
  zone_name: string;
  capacity: number;
  sold: number;
  available: number;
  percentage: number;
}

const emptyMetrics = {
  revenue: { label: 'Ingresos del Mes', value: '$0 MXN', trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0,0] },
  tickets: { label: 'Boletos Vendidos', value: '0', trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0,0] },
  occupancy: { label: 'Ocupación Promedio', value: '0%', trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0,0] },
  upcoming: { label: 'Funciones Próximas', value: '0', trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0,0] },
  commission: { label: 'Comisión Dulos', value: '$0 MXN', trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0,0] },
};

function getActividadIcon(tipo: string): string {
  switch (tipo) {
    case 'venta': return '\u2705';
    case 'reembolso': return '\u26A0\uFE0F';
    case 'checkin': return '\uD83D\uDCC5';
    case 'nuevo_usuario': return '\uD83D\uDC64';
    default: return '\uD83D\uDCCC';
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `hace ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  return `hace ${Math.floor(diffHours / 24)}d`;
}

function SkeletonMetrics() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
      {[1,2,3,4,5].map((i) => (
        <div key={i} className="metric-card p-3">
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export default function SummaryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  const [funcionesProximas, setFuncionesProximas] = useState<FuncionProxima[]>([]);
  const [actividadReciente, setActividadReciente] = useState<Actividad[]>([]);
  const [boletosRecientes, setBoletosRecientes] = useState<{ id: string; ticket: string; cliente: string; evento: string; zona: string; status: string; fecha: string }[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventZoneDetails, setEventZoneDetails] = useState<ZoneDetail[]>([]);
  const [expandedEventData, setExpandedEventData] = useState<FuncionProxima | null>(null);
  const [salesTrendData, setSalesTrendData] = useState<{ day: string; amount: number }[]>([]);
  const [boletosPage, setBoletosPage] = useState(0);
  const [allBoletos, setAllBoletos] = useState<{ id: string; ticket: string; cliente: string; evento: string; zona: string; status: string; fecha: string }[]>([]);
  const [allZones, setAllZones] = useState<TicketZone[]>([]);
  const [allEvents, setAllEvents] = useState<DulosEvent[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [venueMap, setVenueMap] = useState<Map<string, Venue>>(new Map());
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [allActividad, setAllActividad] = useState<Actividad[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary[]>([]);
  const detailRef = useRef<HTMLDivElement>(null);

  const BOLETOS_PER_PAGE = 5;

  useEffect(() => {
    async function loadData() {
      try {
        const [events, zones, orders, checkins, escalations, tickets, schedules, venues, salesData] = await Promise.all([
          fetchEvents().catch(() => [] as DulosEvent[]),
          fetchZones().catch(() => [] as TicketZone[]),
          fetchOrders().catch(() => [] as Order[]),
          fetchCheckins().catch(() => [] as Checkin[]),
          fetchEscalations().catch(() => [] as Escalation[]),
          fetchTickets().catch(() => [] as Ticket[]),
          fetchSchedules().catch(() => [] as Schedule[]),
          getVenueMap().catch(() => new Map<string, Venue>()),
          fetchSalesSummary().catch(() => [] as SalesSummary[]),
        ]);

        setAllZones(zones);
        setAllEvents(events);
        setAllSchedules(schedules);
        setVenueMap(venues);
        setSalesSummary(salesData);

        // Use REAL revenue from v_sales_summary
        const totalRevenue = salesData.reduce((sum, s) => sum + s.total_revenue, 0);
        const totalTicketsSold = salesData.reduce((sum, s) => sum + s.total_tickets_sold, 0);
        const totalOrders = salesData.reduce((sum, s) => sum + s.total_orders, 0);

        // Calculate occupancy from zones (for overall venue capacity perspective)
        const totalZoneTickets = zones.reduce((sum, z) => sum + z.sold, 0);
        const totalAvailable = zones.reduce((sum, z) => sum + z.available + z.sold, 0);
        const occupancy = totalAvailable > 0 ? Math.round((totalZoneTickets / totalAvailable) * 100) : 0;

        // Calculate commission (15% of total revenue)
        const commission = totalRevenue * 0.15;

        setMetrics({
          revenue: { label: 'Ingresos del Mes', value: `$${totalRevenue.toLocaleString()} MXN`, trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0, totalRevenue > 0 ? 100 : 0] },
          tickets: { label: 'Boletos Vendidos', value: totalTicketsSold.toLocaleString(), trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0, totalTicketsSold > 0 ? 100 : 0] },
          occupancy: { label: 'Ocupación Promedio', value: `${occupancy}%`, trend: { value: 0, isPositive: occupancy >= 70 }, sparkline: [0,0,0,0, occupancy] },
          upcoming: { label: 'Funciones Próximas', value: String(events.length), trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0, events.length] },
          commission: { label: 'Comisión Dulos', value: `$${commission.toLocaleString()} MXN`, trend: { value: 0, isPositive: true }, sparkline: [0,0,0,0, commission > 0 ? 100 : 0] },
        });

        // Alerts — enriched with event details
        const eventMap = new Map(events.map((e) => [e.id, e]));
        const newAlertas: Alerta[] = [];

        // Low occupancy events (<30%)
        events.forEach((event, idx) => {
          const ez = zones.filter((z) => z.event_id === event.id);
          const sold = ez.reduce((s, z) => s + z.sold, 0);
          const total = ez.reduce((s, z) => s + z.available + z.sold, 0);
          const occ = total > 0 ? Math.round((sold / total) * 100) : 0;
          if (occ < 30 && total > 0) {
            newAlertas.push({
              id: `low-occ-${idx}`,
              tipo: 'warning',
              mensaje: `${event.name}: ocupación baja (${occ}%)`,
              eventName: event.name,
              imageUrl: event.image_url || '',
              issue: `Ocupación al ${occ}% — solo ${sold} de ${total} vendidos`,
              suggestion: 'Considerar campaña de promoción o descuento',
            });
          }
        });

        // Zones with low availability
        zones.forEach((zone, idx) => {
          if (zone.available < 50 && zone.available > 0) {
            const eventName = eventMap.get(zone.event_id)?.name || zone.event_id;
            const imageUrl = eventMap.get(zone.event_id)?.image_url || '';
            newAlertas.push({
              id: `z-${idx}`,
              tipo: 'critico',
              mensaje: `${eventName} - ${zone.zone_name}: ${zone.available} lugares`,
              eventName,
              imageUrl,
              issue: `Solo quedan ${zone.available} lugares en ${zone.zone_name}`,
              suggestion: 'Preparar lista de espera o abrir zona adicional',
            });
          }
        });

        // Escalations
        escalations.forEach((esc, idx) => {
          newAlertas.push({
            id: `e-${idx}`,
            tipo: 'critico',
            mensaje: `${esc.reason} - ${esc.event_mentioned}`,
            eventName: esc.event_mentioned,
            imageUrl: '',
            issue: esc.situation || esc.reason,
            suggestion: 'Revisar y resolver escalación',
          });
        });

        setAlertas(newAlertas.slice(0, 8));

        // Enhanced revenue matching to handle different event_id formats

        // Funciones from events + zones
        setFuncionesProximas(events.slice(0, 6).map((event, idx) => {
          const ez = zones.filter((z) => z.event_id === event.id);
          const sold = ez.reduce((s, z) => s + z.sold, 0);
          const total = ez.reduce((s, z) => s + z.available + z.sold, 0);
          const venueName = getVenueName(event.venue_id, venues);
          const venueCity = getVenueCity(event.venue_id, venues);
          const venueDisplay = venueCity ? `${venueName} · ${venueCity}` : venueName;

          // Use schedule dates when available (fix for date format issue)
          const eventSchedules = schedules.filter((s) => s.event_id === event.id);
          const scheduleDate = eventSchedules.length > 0 ? eventSchedules[0].date : null;
          let eventDate = 'TBD';

          if (scheduleDate) {
            // Use schedule date (more accurate)
            eventDate = new Date(scheduleDate).toLocaleDateString('es-MX', {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
          } else if (event.start_date) {
            // Fallback to event start_date
            eventDate = new Date(event.start_date).toLocaleDateString('es-MX', {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
          }

          // Try multiple matching strategies for revenue
          let sale = salesData.find(s => s.event_id === event.id);
          if (!sale) {
            // Try case-insensitive match
            sale = salesData.find(s => s.event_id?.toLowerCase() === event.id?.toLowerCase());
          }
          if (!sale) {
            // Try matching by name
            sale = salesData.find(s => s.event_id === event.name || s.event_id?.toLowerCase() === event.name?.toLowerCase());
          }


          return {
            id: idx + 1,
            eventId: event.id,
            nombre: event.name,
            hora: eventDate,
            sala: venueDisplay,
            ocupacion: total > 0 ? Math.round((sold / total) * 100) : 0,
            available: ez.reduce((s, z) => s + z.available, 0),
            image_url: event.image_url || '',
            revenue: sale?.total_revenue || 0,
            orders: sale?.total_orders || 0,
            ticketsSold: sale?.total_tickets_sold || sold, // Fallback to zone sold count
          };
        }));

        // Activity — enriched with amounts and icons
        const actividades: Actividad[] = [];
        const seen = new Set<string>();

        // Build a price map for zones
        const zonePriceMap = new Map<string, number>();
        zones.forEach(z => {
          const key = `${z.event_id}-${z.zone_name}`;
          zonePriceMap.set(key, z.price);
        });

        orders.filter(o => o.customer_name && o.customer_name !== 'null').slice(0, 20).forEach((o) => {
          const eventName = eventMap.get(o.event_id)?.name || o.event_id;
          const key = `${o.customer_name}-${eventName}`;
          if (!seen.has(key)) {
            seen.add(key);
            const price = zonePriceMap.get(`${o.event_id}-${o.zone_name}`) || 0;
            actividades.push({
              id: `or-${o.order_number}`,
              tipo: 'venta',
              mensaje: `${o.customer_name} \u2192 ${eventName}`,
              tiempo: formatTimeAgo(o.purchased_at),
              monto: price > 0 ? price * o.quantity : undefined,
            });
          }
        });

        checkins.filter(c => c.customer_name && c.customer_name !== 'DUPLICADO').slice(0, 10).forEach((c) => {
          const key = `${c.customer_name}-${c.event_name}`;
          if (!seen.has(key)) {
            seen.add(key);
            actividades.push({
              id: `ci-${c.id}`,
              tipo: 'checkin',
              mensaje: `${c.customer_name} \u2192 ${c.event_name}`,
              tiempo: formatTimeAgo(c.scanned_at),
            });
          }
        });

        // Add fallback if no activities
        if (actividades.length === 0) {
          actividades.push({
            id: 'empty',
            tipo: 'info',
            mensaje: 'Sin actividad reciente',
            tiempo: '',
          });
        }

        setAllActividad(actividades);
        setActividadReciente(actividades.slice(0, 6));

        // All boletos for pagination
        const allBoletosData = tickets.filter(t => t.customer_name).map(t => ({
          id: t.id,
          ticket: t.ticket_number,
          cliente: t.customer_name || 'Anónimo',
          evento: eventMap.get(t.event_id)?.name || t.event_id,
          zona: t.zone_name,
          status: t.status,
          fecha: formatTimeAgo(t.created_at),
        }));
        setAllBoletos(allBoletosData);
        setBoletosRecientes(allBoletosData.slice(0, BOLETOS_PER_PAGE));

        // Sales trend — last 7 days from ticket creation dates
        const now = new Date();
        const dailyMap = new Map<string, number>();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          dailyMap.set(dateStr, 0);
        }

        // Aggregate ticket sales by day using zone prices
        tickets.forEach((ticket) => {
          if (ticket.created_at) {
            const dateStr = ticket.created_at.split('T')[0];
            if (dailyMap.has(dateStr)) {
              const price = zonePriceMap.get(`${ticket.event_id}-${ticket.zone_name}`) || 0;
              dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + price);
            }
          }
        });

        const trendData = Array.from(dailyMap.entries()).map(([dateStr, amount]) => {
          const d = new Date(dateStr);
          return { day: DAY_NAMES[d.getDay()], amount };
        });
        setSalesTrendData(trendData);

        setLoading(false);
      } catch (err) {
        console.error('Error loading dashboard:', err);
        setError('Error conectando con Supabase.');
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Handle event card click — expand/collapse detail panel
  const handleEventClick = (funcion: FuncionProxima) => {
    if (expandedEventId === funcion.eventId) {
      setExpandedEventId(null);
      setExpandedEventData(null);
      setEventZoneDetails([]);
      return;
    }

    setExpandedEventId(funcion.eventId);
    setExpandedEventData(funcion);

    // Build zone details for this event
    const ez = allZones.filter((z) => z.event_id === funcion.eventId);
    const details: ZoneDetail[] = ez.map(z => {
      const capacity = z.available + z.sold;
      return {
        zone_name: z.zone_name,
        capacity,
        sold: z.sold,
        available: z.available,
        percentage: capacity > 0 ? Math.round((z.sold / capacity) * 100) : 0,
      };
    });
    setEventZoneDetails(details);

    // Scroll to detail after render
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  // Boletos pagination
  const totalBoletos = allBoletos.length;
  const totalPages = Math.ceil(totalBoletos / BOLETOS_PER_PAGE);
  const paginatedBoletos = allBoletos.slice(boletosPage * BOLETOS_PER_PAGE, (boletosPage + 1) * BOLETOS_PER_PAGE);

  if (loading) return <div className="space-y-3"><SkeletonMetrics /><div className="h-40 bg-gray-100 rounded-lg animate-pulse" /></div>;

  if (error) return (
    <div className="flex flex-col items-center justify-center py-12 text-red-500">
      <p className="text-sm font-medium">{error}</p>
      <button onClick={() => window.location.reload()} className="mt-2 text-xs text-[#E63946] hover:underline">Reintentar</button>
    </div>
  );

  const displayedActividad = showAllActivity ? allActividad : actividadReciente;

  return (
    <div className="space-y-4">
      <HeroMetrics revenue={metrics.revenue} tickets={metrics.tickets} occupancy={metrics.occupancy} upcoming={metrics.upcoming} commission={metrics.commission} />

      {/* Eventos — revenue + funciones unificados */}
      <div className="section-card">
        <div className="section-card-header !py-2 !px-3">
          <span className="font-bold text-gray-900 text-sm">Eventos</span>
          {alertas.length > 0 && (
            <button
              onClick={() => setAlertsPanelOpen(!alertsPanelOpen)}
              className="badge badge-error ml-auto text-xs cursor-pointer hover:opacity-80 transition-opacity"
            >
              {alertas.length} alertas
            </button>
          )}
        </div>

        {/* Alerts panel — collapsible */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: alertsPanelOpen ? `${alertas.length * 80 + 16}px` : '0px' }}
        >
          <div className="px-3 pb-3 space-y-2">
            {alertas.map((a) => (
              <div key={a.id} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${a.tipo === 'critico' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                {a.imageUrl && (
                  <img src={a.imageUrl} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold ${a.tipo === 'critico' ? 'text-red-800' : 'text-amber-800'}`}>{a.eventName}</p>
                  <p className={`${a.tipo === 'critico' ? 'text-red-600' : 'text-amber-600'}`}>{a.issue}</p>
                  <p className="text-gray-500 mt-0.5 italic">{a.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {funcionesProximas.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
            {funcionesProximas.map((f) => {
              const hasAlert = alertas.some(a => a.mensaje.toLowerCase().includes(f.nombre.toLowerCase()));
              const isExpanded = expandedEventId === f.eventId;
              return (
                <div
                  key={f.id}
                  onClick={() => handleEventClick(f)}
                  className={`flex gap-0 rounded-xl border overflow-hidden transition-all hover:shadow-sm cursor-pointer ${isExpanded ? 'ring-2 ring-[#E63946] border-[#E63946]' : hasAlert ? 'border-red-200 bg-red-50/30' : 'border-gray-100 bg-white'}`}
                >
                  {f.image_url ? (
                    <img src={f.image_url} alt="" className="w-16 sm:w-20 object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 sm:w-20 bg-gray-100 flex items-center justify-center flex-shrink-0">🎭</div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-center py-2 sm:py-2.5 px-2 sm:px-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-extrabold text-gray-900 text-xs sm:text-[13px] truncate leading-tight">{f.nombre}</p>
                      <span className={`text-xs sm:text-[13px] font-black flex-shrink-0 ${f.ocupacion >= 80 ? 'text-red-500' : f.ocupacion >= 50 ? 'text-amber-500' : 'text-gray-300'}`}>{f.ocupacion}%</span>
                    </div>
                    <p className="text-[11px] sm:text-[12px] text-gray-500 mt-0.5 truncate font-medium">{f.hora} · {f.sala}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[11px] sm:text-[12px] font-black text-[#E63946]">${f.revenue.toLocaleString()}</span>
                      <span className={`text-[10px] sm:text-[11px] font-bold ${f.available < 50 ? 'text-red-500' : 'text-emerald-600'}`}>{f.available} disp.</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Expanded event detail panel */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: expandedEventId ? '500px' : '0px' }}
        >
          {expandedEventData && (
            <div ref={detailRef} className="border-t border-gray-100 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Left: larger event image */}
                {expandedEventData.image_url ? (
                  <img
                    src={expandedEventData.image_url}
                    alt={expandedEventData.nombre}
                    className="w-full sm:w-[200px] h-[160px] sm:h-[130px] rounded-xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-full sm:w-[200px] h-[160px] sm:h-[130px] rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-3xl text-gray-400">🎭</div>
                )}

                {/* Right: event info + occupancy bar */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-gray-900 text-base">{expandedEventData.nombre}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{expandedEventData.sala}</p>
                  <p className="text-sm text-gray-500">{expandedEventData.hora}</p>

                  {/* Occupancy bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-600">Ocupación</span>
                      <span className={`text-xs font-black ${expandedEventData.ocupacion >= 80 ? 'text-red-500' : expandedEventData.ocupacion >= 50 ? 'text-amber-500' : 'text-green-500'}`}>
                        {expandedEventData.ocupacion}%
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${expandedEventData.ocupacion >= 80 ? 'bg-[#E63946]' : expandedEventData.ocupacion >= 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(expandedEventData.ocupacion, 100)}%` }}
                      />
                    </div>
                  </div>

                  <p className={`text-sm font-bold mt-2 ${expandedEventData.available < 50 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {expandedEventData.available} lugares disponibles
                  </p>
                </div>
              </div>

              {/* Zone details table */}
              {eventZoneDetails.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-1.5 font-bold">Zona</th>
                        <th className="pb-1.5 font-bold text-right">Capacidad</th>
                        <th className="pb-1.5 font-bold text-right">Vendidos</th>
                        <th className="pb-1.5 font-bold text-right">Disponibles</th>
                        <th className="pb-1.5 font-bold text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventZoneDetails.map((z, idx) => (
                        <tr key={idx} className="border-b border-gray-50 last:border-0">
                          <td className="py-1.5 font-bold text-gray-900">{z.zone_name}</td>
                          <td className="py-1.5 text-right text-gray-600">{z.capacity}</td>
                          <td className="py-1.5 text-right text-gray-600">{z.sold}</td>
                          <td className={`py-1.5 text-right font-bold ${z.available < 50 ? 'text-red-500' : 'text-gray-600'}`}>{z.available}</td>
                          <td className="py-1.5 text-right">
                            <span className={`font-black ${z.percentage >= 80 ? 'text-red-500' : z.percentage >= 50 ? 'text-amber-500' : 'text-gray-400'}`}>
                              {z.percentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actividad + Boletos side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Actividad Reciente — enriched */}
        {actividadReciente.length > 0 && (
          <div className="section-card">
            <div className="section-card-header !py-2 !px-3">
              <span className="font-bold text-gray-900 text-sm">Actividad Reciente</span>
              {salesTrendData.length > 0 && (
                <div className="ml-auto" style={{ width: 80, height: 24 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesTrendData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                      <defs>
                        <linearGradient id="miniSalesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="amount" stroke="#EF4444" strokeWidth={1.5} fill="url(#miniSalesGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {displayedActividad.map((a) => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-sm flex-shrink-0 w-5 text-center">{getActividadIcon(a.tipo)}</span>
                  <p className="flex-1 text-xs sm:text-[13px] text-gray-700 truncate font-medium">{a.mensaje}</p>
                  {a.monto !== undefined && a.monto > 0 && (
                    <span className="text-[11px] sm:text-[12px] text-emerald-600 font-bold tabular-nums flex-shrink-0">
                      ${a.monto.toLocaleString()}
                    </span>
                  )}
                  <span className="text-[11px] sm:text-[12px] text-gray-400 tabular-nums font-semibold flex-shrink-0">{a.tiempo}</span>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-gray-50">
              <button
                onClick={() => {
                  if (showAllActivity) {
                    setShowAllActivity(false);
                  } else if (allActividad.length > 6) {
                    setShowAllActivity(true);
                  }
                  // Removed toast notification
                }}
                className={`text-xs font-bold ${allActividad.length > 6 || showAllActivity ? 'text-[#E63946] hover:underline cursor-pointer' : 'text-gray-400 cursor-not-allowed'}`}
                disabled={allActividad.length <= 6 && !showAllActivity}
              >
                {showAllActivity ? 'Mostrar menos' : allActividad.length > 6 ? 'Ver todo' : 'Ver todo'}
              </button>
            </div>
          </div>
        )}

        {/* Boletos Vendidos — enhanced with pagination */}
        {allBoletos.length > 0 && (
          <div className="section-card">
            <div className="section-card-header !py-2 !px-3">
              <span className="font-bold text-gray-900 text-sm">Boletos Vendidos</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="px-3 py-1.5 font-medium">Ticket</th>
                    <th className="px-3 py-1.5 font-medium">Cliente</th>
                    <th className="px-3 py-1.5 font-medium hidden sm:table-cell">Evento</th>
                    <th className="px-3 py-1.5 font-medium hidden md:table-cell">Zona</th>
                    <th className="px-3 py-1.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBoletos.map((b) => (
                    <tr key={b.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-1.5 font-mono text-xs text-[#E63946]">{b.ticket}</td>
                      <td className="px-3 py-1.5 text-gray-900 truncate max-w-[100px] sm:max-w-none">{b.cliente}</td>
                      <td className="px-3 py-1.5 text-gray-600 truncate max-w-[120px] hidden sm:table-cell">{b.evento}</td>
                      <td className="px-3 py-1.5 text-gray-500 hidden md:table-cell">{b.zona}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${b.status === 'valid' ? 'bg-green-50 text-green-700' : b.status === 'used' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {b.status === 'valid' ? 'Válido' : b.status === 'used' ? 'Usado' : b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalBoletos > BOLETOS_PER_PAGE && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-50 text-xs text-gray-500">
                <span>
                  {boletosPage * BOLETOS_PER_PAGE + 1}-{Math.min((boletosPage + 1) * BOLETOS_PER_PAGE, totalBoletos)} de {totalBoletos}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setBoletosPage(Math.max(0, boletosPage - 1))}
                    disabled={boletosPage === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button
                    onClick={() => setBoletosPage(Math.min(totalPages - 1, boletosPage + 1))}
                    disabled={boletosPage >= totalPages - 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  );
}
