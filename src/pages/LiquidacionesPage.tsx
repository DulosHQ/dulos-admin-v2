'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  fetchAllDispersions,
  fetchAllEvents,
  fetchSchedules,
  fetchAllOrders,
  fetchEventCommissions,
  fetchAdSpendDaily,
  createDispersion,
  updateDispersion,
  getVenueMap,
  getVenueName,
  Dispersion,
  DulosEvent,
  Schedule,
  Order,
  EventCommission,
} from '../lib/supabase';

type StatusFilter = 'all' | 'pending' | 'approved' | 'paid';

interface GenerateDispersionData {
  schedule: Schedule;
  event: DulosEvent;
  venue_name: string;
  orders: Order[];
  gross_revenue: number;
  discounts: number;
  refunds: number;
  net_revenue: number;
  commission_rate: number;
  platform_fee: number;
  stripe_fee: number;
  ad_spend: number;
  net_payout: number;
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
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

// Get Monday of the week containing the given date
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

// Get Sunday of the week containing the given date
function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return weekEnd;
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800'
  };

  const icons = {
    pending: '⏳',
    approved: '✅',
    paid: '💰'
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
      {icons[status as keyof typeof icons]} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#111] rounded-xl p-4 animate-pulse">
      <div className="h-3 bg-gray-700 rounded w-2/3 mb-2"></div>
      <div className="h-6 bg-gray-700 rounded w-1/2"></div>
    </div>
  );
}

export default function LiquidacionesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingAdSpend, setEditingAdSpend] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  
  // Raw data
  const [dispersions, setDispersions] = useState<Dispersion[]>([]);
  const [events, setEvents] = useState<DulosEvent[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [commissions, setCommissions] = useState<EventCommission[]>([]);
  const [venueMap, setVenueMap] = useState<Map<string, any>>(new Map());
  const [generatableSchedules, setGeneratableSchedules] = useState<GenerateDispersionData[]>([]);

  // Load all data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        const [
          dispersionsData,
          eventsData,
          schedulesData,
          ordersData,
          commissionsData,
          venueMapData,
        ] = await Promise.all([
          fetchAllDispersions(),
          fetchAllEvents(),
          fetchSchedules(),
          fetchAllOrders(),
          fetchEventCommissions(),
          getVenueMap(),
        ]);

        setDispersions(dispersionsData);
        setEvents(eventsData);
        setSchedules(schedulesData);
        setOrders(ordersData);
        setCommissions(commissionsData);
        setVenueMap(venueMapData);
      } catch (err) {
        console.error('Error loading liquidaciones data:', err);
        setError('Error cargando datos de liquidaciones');
        toast.error('Error cargando datos de liquidaciones');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const pending = dispersions.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.net_payout, 0);
    const approved = dispersions.filter(d => d.status === 'approved').reduce((sum, d) => sum + d.net_payout, 0);
    const paid = dispersions.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.net_payout, 0);

    return { pending, approved, paid };
  }, [dispersions]);

  // Filter dispersions
  const filteredDispersions = useMemo(() => {
    return dispersions.filter(d => {
      if (eventFilter !== 'all' && d.event_id !== eventFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      return true;
    });
  }, [dispersions, eventFilter, statusFilter]);

  // Load generatable schedules when modal opens
  useEffect(() => {
    if (!showGenerateModal) return;

    async function loadGeneratable() {
      try {
        const today = new Date();
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // Find schedules that are 7+ days past and don't have a dispersion yet
        const existingScheduleIds = new Set(dispersions.filter(d => d.schedule_id).map(d => d.schedule_id));
        const eligibleSchedules = schedules.filter(s => {
          const scheduleDate = new Date(s.date);
          return scheduleDate <= sevenDaysAgo && !existingScheduleIds.has(s.id) && s.status === 'active';
        });

        const eventMap = new Map(events.map(e => [e.id, e]));
        const commissionMap = new Map(commissions.map(c => [c.event_id, c.commission_rate]));
        
        const generatable: GenerateDispersionData[] = [];

        for (const schedule of eligibleSchedules) {
          const event = eventMap.get(schedule.event_id);
          if (!event) continue;

          const venue_name = getVenueName(event.venue_id, venueMap);
          
          // Get orders for this schedule
          const scheduleOrders = orders.filter(o => 
            o.schedule_id === schedule.id && 
            ['completed', 'paid'].includes(o.payment_status)
          );
          
          const refundOrders = orders.filter(o => 
            o.schedule_id === schedule.id && 
            o.payment_status === 'refunded'
          );

          if (scheduleOrders.length === 0) continue; // Skip if no sales

          const gross_revenue = scheduleOrders.reduce((sum, o) => sum + o.total_price, 0);
          const discounts = scheduleOrders.reduce((sum, o) => sum + (o.discount_amount || 0), 0);
          const refunds = refundOrders.reduce((sum, o) => sum + o.total_price, 0);
          const net_revenue = gross_revenue - discounts - refunds;
          
          if (net_revenue <= 0) continue; // Skip if no net revenue

          const commission_rate = commissionMap.get(event.id) || 0.15;
          const platform_fee = net_revenue * commission_rate;
          const stripe_fee = scheduleOrders.reduce((sum, o) => sum + (o.stripe_fee || 0), 0);
          
          // Calculate ad spend for the week
          const scheduleDate = new Date(schedule.date);
          const weekStart = getWeekStart(scheduleDate);
          const weekEnd = getWeekEnd(scheduleDate);
          
          // For now, ad spend is 0 (will be filled manually or via API later)
          const ad_spend = 0;
          
          const net_payout = net_revenue - platform_fee - stripe_fee - ad_spend;

          generatable.push({
            schedule,
            event,
            venue_name,
            orders: scheduleOrders,
            gross_revenue,
            discounts,
            refunds,
            net_revenue,
            commission_rate,
            platform_fee,
            stripe_fee,
            ad_spend,
            net_payout,
          });
        }

        // Sort by function date desc
        generatable.sort((a, b) => new Date(b.schedule.date).getTime() - new Date(a.schedule.date).getTime());
        setGeneratableSchedules(generatable);
      } catch (error) {
        console.error('Error loading generatable schedules:', error);
        toast.error('Error cargando funciones generables');
      }
    }

    loadGeneratable();
  }, [showGenerateModal, dispersions, schedules, events, orders, commissions, venueMap]);

  const handleApprove = async (id: string) => {
    try {
      const success = await updateDispersion(id, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: 'admin', // In a real app, this would be the current user's email
      });

      if (success) {
        setDispersions(prev => prev.map(d => 
          d.id === id 
            ? { ...d, status: 'approved', approved_at: new Date().toISOString(), approved_by: 'admin' }
            : d
        ));
        toast.success('Liquidación aprobada');
      } else {
        toast.error('Error aprobando liquidación');
      }
    } catch (error) {
      console.error('Error approving dispersion:', error);
      toast.error('Error aprobando liquidación');
    }
  };

  const handleMarkPaid = async () => {
    if (!showPaymentModal || !paymentReference.trim()) {
      toast.error('Ingresa referencia de pago');
      return;
    }

    try {
      const success = await updateDispersion(showPaymentModal, {
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_reference: paymentReference.trim(),
        payment_method: paymentMethod || 'SPEI',
      });

      if (success) {
        setDispersions(prev => prev.map(d => 
          d.id === showPaymentModal 
            ? { 
                ...d, 
                status: 'paid', 
                paid_at: new Date().toISOString(),
                payment_reference: paymentReference.trim(),
                payment_method: paymentMethod || 'SPEI'
              }
            : d
        ));
        toast.success('Liquidación marcada como pagada');
        setShowPaymentModal(null);
        setPaymentReference('');
        setPaymentMethod('');
      } else {
        toast.error('Error marcando como pagada');
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Error marcando como pagada');
    }
  };

  const handleUpdateAdSpend = async (id: string, newValue: number) => {
    try {
      const success = await updateDispersion(id, { ad_spend: newValue });

      if (success) {
        setDispersions(prev => prev.map(d => {
          if (d.id === id) {
            const updatedNetPayout = d.net_revenue - d.platform_fee - d.stripe_fee - newValue;
            return { ...d, ad_spend: newValue, net_payout: updatedNetPayout };
          }
          return d;
        }));
        toast.success('Ad spend actualizado');
      } else {
        toast.error('Error actualizando ad spend');
      }
    } catch (error) {
      console.error('Error updating ad spend:', error);
      toast.error('Error actualizando ad spend');
    }
  };

  const handleGenerate = async (data: GenerateDispersionData) => {
    try {
      const scheduleDate = new Date(data.schedule.date);
      const weekStart = getWeekStart(scheduleDate);
      const weekEnd = getWeekEnd(scheduleDate);

      const dispersionData: Omit<Dispersion, 'id' | 'created_at'> = {
        event_id: data.event.id,
        schedule_id: data.schedule.id,
        period_start: weekStart.toISOString().split('T')[0],
        period_end: weekEnd.toISOString().split('T')[0],
        function_date: data.schedule.date,
        gross_revenue: data.gross_revenue,
        discounts: data.discounts,
        refunds: data.refunds,
        net_revenue: data.net_revenue,
        commission_rate: data.commission_rate,
        platform_fee: data.platform_fee,
        ad_spend: data.ad_spend,
        stripe_fee: data.stripe_fee,
        net_payout: data.net_payout,
        status: 'pending',
        approved_at: null,
        approved_by: null,
        paid_at: null,
        payment_reference: null,
        payment_method: null,
        notes: null,
      };

      const newDispersion = await createDispersion(dispersionData);

      if (newDispersion) {
        setDispersions(prev => [newDispersion, ...prev]);
        setGeneratableSchedules(prev => prev.filter(g => g.schedule.id !== data.schedule.id));
        toast.success(`Liquidación generada para ${data.event.name}`);
      } else {
        toast.error('Error generando liquidación');
      }
    } catch (error) {
      console.error('Error generating dispersion:', error);
      toast.error('Error generando liquidación');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
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
      {/* KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[#111] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Total Pendiente</p>
          <p className="text-2xl font-black text-yellow-400">{fmtCurrency(kpis.pending)}</p>
        </div>

        <div className="bg-[#111] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Total Aprobado</p>
          <p className="text-2xl font-black text-blue-400">{fmtCurrency(kpis.approved)}</p>
        </div>

        <div className="bg-[#111] rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Total Pagado</p>
          <p className="text-2xl font-black text-green-400">{fmtCurrency(kpis.paid)}</p>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4">
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="bg-[#111] text-white border border-gray-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">Todos los eventos</option>
            {events.filter(e => e.status === 'active').map(event => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-[#111] text-white border border-gray-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobados</option>
            <option value="paid">Pagados</option>
          </select>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Generar Liquidación
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-[#111] rounded-xl">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Liquidaciones</h2>
          <p className="text-xs text-gray-400">Liquidaciones de eventos por función</p>
        </div>

        {filteredDispersions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">No hay liquidaciones disponibles</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 text-xs text-gray-400 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Función</th>
                  <th className="px-4 py-3 text-left">Evento</th>
                  <th className="px-4 py-3 text-left">Venue</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Comisión</th>
                  <th className="px-4 py-3 text-right">Ad Spend</th>
                  <th className="px-4 py-3 text-right">Stripe</th>
                  <th className="px-4 py-3 text-right">Payout</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredDispersions.map((dispersion) => {
                  const event = events.find(e => e.id === dispersion.event_id);
                  const venue_name = event ? getVenueName(event.venue_id, venueMap) : '';
                  const isExpanded = expandedRow === dispersion.id;

                  return (
                    <React.Fragment key={dispersion.id}>
                      <tr className="hover:bg-gray-900/50 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">
                          {dispersion.function_date ? fmtDate(dispersion.function_date) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{event?.name || dispersion.event_id}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          {venue_name}
                        </td>
                        <td className="px-4 py-3 text-right text-green-400 font-medium">
                          {fmtCurrency(dispersion.net_revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-400 font-medium">
                          {fmtCurrency(dispersion.platform_fee)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingAdSpend === dispersion.id ? (
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(Number(e.target.value))}
                              onBlur={() => {
                                handleUpdateAdSpend(dispersion.id, editValue);
                                setEditingAdSpend(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateAdSpend(dispersion.id, editValue);
                                  setEditingAdSpend(null);
                                }
                              }}
                              className="bg-gray-800 text-white px-2 py-1 rounded text-sm w-20"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setEditingAdSpend(dispersion.id);
                                setEditValue(dispersion.ad_spend);
                              }}
                              className="text-purple-400 hover:text-purple-300 font-medium"
                            >
                              {fmtCurrency(dispersion.ad_spend)}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-red-400 font-medium">
                          {fmtCurrency(dispersion.stripe_fee)}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-400 font-medium">
                          {fmtCurrency(dispersion.net_payout)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={dispersion.status} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-2 justify-center">
                            {dispersion.status === 'pending' && (
                              <button
                                onClick={() => handleApprove(dispersion.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                              >
                                Aprobar
                              </button>
                            )}
                            
                            {dispersion.status === 'approved' && (
                              <button
                                onClick={() => setShowPaymentModal(dispersion.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                              >
                                Marcar Pagada
                              </button>
                            )}
                            
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : dispersion.id)}
                              className="text-gray-400 hover:text-white text-xs"
                            >
                              {isExpanded ? 'Ocultar' : 'Ver Detalle'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="px-4 py-4 bg-gray-900/50">
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-400">Revenue Bruto</p>
                                  <p className="text-white font-medium">{fmtCurrency(dispersion.gross_revenue)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400">Descuentos</p>
                                  <p className="text-red-400 font-medium">{fmtCurrency(dispersion.discounts)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400">Reembolsos</p>
                                  <p className="text-red-400 font-medium">{fmtCurrency(dispersion.refunds)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400">Tasa Comisión</p>
                                  <p className="text-white font-medium">{(dispersion.commission_rate * 100).toFixed(1)}%</p>
                                </div>
                              </div>
                              
                              {dispersion.period_start && dispersion.period_end && (
                                <div>
                                  <p className="text-gray-400 text-xs">Periodo Ad Spend</p>
                                  <p className="text-white text-sm">{fmtDate(dispersion.period_start)} - {fmtDate(dispersion.period_end)}</p>
                                </div>
                              )}
                              
                              {dispersion.paid_at && (
                                <div>
                                  <p className="text-gray-400 text-xs">Pago</p>
                                  <p className="text-green-400 text-sm">
                                    {dispersion.payment_method} - {dispersion.payment_reference} ({fmtDate(dispersion.paid_at)})
                                  </p>
                                </div>
                              )}
                              
                              {dispersion.notes && (
                                <div>
                                  <p className="text-gray-400 text-xs">Notas</p>
                                  <p className="text-white text-sm">{dispersion.notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111] rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Generar Liquidaciones</h3>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Funciones elegibles (7+ días pasadas, sin liquidación)
              </p>
            </div>
            
            <div className="p-4 max-h-96 overflow-y-auto">
              {generatableSchedules.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No hay funciones elegibles para generar liquidación</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {generatableSchedules.map((data) => (
                    <div key={data.schedule.id} className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-white">{data.event.name}</h4>
                          <p className="text-sm text-gray-400">
                            {fmtDate(data.schedule.date)} • {data.venue_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-400">
                            {fmtCurrency(data.net_payout)}
                          </p>
                          <p className="text-xs text-gray-400">Payout neto</p>
                        </div>
                      </div>
                      
                      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-gray-500">Revenue</p>
                          <p className="text-white">{fmtCurrency(data.net_revenue)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Comisión</p>
                          <p className="text-orange-400">{fmtCurrency(data.platform_fee)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Stripe</p>
                          <p className="text-red-400">{fmtCurrency(data.stripe_fee)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Ad Spend</p>
                          <p className="text-purple-400">{fmtCurrency(data.ad_spend)}</p>
                        </div>
                      </div>
                      
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => handleGenerate(data)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Generar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111] rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Marcar como Pagada</h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Referencia de Pago *
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="REF123456"
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Método de Pago
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2"
                >
                  <option value="SPEI">SPEI</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Efectivo">Efectivo</option>
                </select>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-800 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowPaymentModal(null);
                  setPaymentReference('');
                  setPaymentMethod('');
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleMarkPaid}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Marcar Pagada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}