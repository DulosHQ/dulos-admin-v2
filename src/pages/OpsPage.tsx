'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  fetchCheckins,
  fetchAllCoupons,
  fetchTickets,
  fetchNotificationLogs,
  fetchAllEvents,
  fetchReservas,
  fetchBoletos,
  Checkin,
  Coupon,
  Ticket,
  Customer,
  AuditLog,
  DulosEvent
} from '../lib/supabase'
import { createCoupon as createCouponAction } from '../app/actions/coupons.actions'
import { couponSchema } from '../lib/validations/coupons.schema'

const ACCENT = '#E63946'
const PAGE_SIZE = 20

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

// Data parsing helper functions
function parseEventoName(evento: string): string {
  if (evento.length > 50) {
    return evento.substring(0, 50) + '...'
  }
  return evento
}

function parseClienteName(cliente: string): string {
  const emailIndex = cliente.indexOf('@')
  if (emailIndex > 0) {
    // Find where the email starts by looking backwards for lowercase letter transition
    let start = emailIndex
    while (start > 0 && /[a-z]/.test(cliente[start - 1])) {
      start--
    }
    return cliente.substring(0, start)
  }
  return cliente
}

function parseMonto(monto: string): number {
  return parseFloat(monto.replace(/[$,]/g, '')) || 0
}

export default function OpsPage() {
  const [loading, setLoading] = useState(true)
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [cupones, setCupones] = useState<Coupon[]>([])
  const [notificationLogs, setNotificationLogs] = useState<AuditLog[]>([])
  const [events, setEvents] = useState<DulosEvent[]>([])
  const [filtroEvento, setFiltroEvento] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [searchResults, setSearchResults] = useState<(Customer & { tickets?: Ticket[] })[]>([])
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [scanResult, setScanResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [manualTicket, setManualTicket] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // New data for Reservas and Boletos
  const [reservas, setReservas] = useState<any[]>([])
  const [reservasHeaders, setReservasHeaders] = useState<string[]>([])
  const [boletos, setBoletos] = useState<any[]>([])
  const [boletosHeaders, setBoletosHeaders] = useState<string[]>([])

  // Active tab state
  const [activeTab, setActiveTab] = useState('checkins')

  // Search states
  const [reservasSearch, setReservasSearch] = useState('')
  const [boletosSearch, setBoletosSearch] = useState('')

  // Pagination state
  const [checkinPage, setCheckinPage] = useState(0)
  const [reservasPage, setReservasPage] = useState(0)
  const [boletosPage, setBoletosPage] = useState(0)

  // Coupon modal state
  const [showCouponModal, setShowCouponModal] = useState(false)
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    event_id: '',
    max_uses: '',
    valid_until: '',
  })
  const [couponSubmitting, setCouponSubmitting] = useState(false)
  const [couponErrors, setCouponErrors] = useState<Record<string, string>>({})

  // Notification filter
  const [notifFilter, setNotifFilter] = useState(false)

  // Helper to search customers
  const { searchCustomerByNameOrEmail } = require('../lib/supabase')

  useEffect(() => {
    Promise.all([
      fetchCheckins().catch(() => []),
      fetchAllCoupons().catch(() => []),
      fetchTickets().catch(() => []),
      fetchNotificationLogs().catch(() => []),
      fetchAllEvents().catch(() => []),
      fetchReservas().catch(() => ({ headers: [], rows: [], totalRows: 0 })),
      fetchBoletos().catch(() => ({ headers: [], rows: [], totalRows: 0 })),
    ]).then(([ci, co, tk, nl, ev, rs, bl]) => {
      setCheckins(ci.filter((c: Checkin) => c.customer_name && c.customer_name !== 'DUPLICADO'))
      setCupones(co)
      setTickets(tk)
      setNotificationLogs(nl)
      setEvents(ev)
      setReservas(rs.rows || [])
      setReservasHeaders(rs.headers || [])
      setBoletos(bl.rows || [])
      setBoletosHeaders(bl.headers || [])
      setLoading(false)
    })
  }, [])

  // Customer search function
  const handleCustomerSearch = async () => {
    if (!customerSearch.trim()) return
    try {
      const results = await searchCustomerByNameOrEmail(customerSearch.trim())
      setSearchResults(results)
      setExpandedCustomer(null)
    } catch (error) {
      console.error('Error searching customers:', error)
      toast.error('Error al buscar clientes')
    }
  }

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
      setScanResult(null)
      toast.success('Cámara activa — apunta al código QR')
    } catch (err: unknown) {
      const errorMsg = err instanceof DOMException
        ? err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Habilita el acceso en la configuración del navegador.'
          : err.name === 'NotFoundError'
            ? 'No se encontró una cámara en este dispositivo.'
            : `Error de cámara: ${err.message}`
        : 'No se pudo acceder a la cámara'
      toast.error(errorMsg)
    }
  }, [])

  const handleManualScan = () => {
    if (!manualTicket.trim()) return
    const ticket = tickets.find(t => t.ticket_number === manualTicket.trim() || t.ticket_token === manualTicket.trim())
    if (ticket) {
      if (ticket.status === 'used') {
        setScanResult({ ok: false, msg: `Boleto ya usado — ${ticket.customer_name}` })
        toast.warning(`Boleto ya usado — ${ticket.customer_name}`)
      } else {
        setScanResult({ ok: true, msg: `Válido — ${ticket.customer_name} · ${ticket.zone_name}` })
        toast.success(`Válido — ${ticket.customer_name} · ${ticket.zone_name}`)
      }
    } else {
      setScanResult({ ok: false, msg: 'Boleto no encontrado' })
      toast.error('Boleto no encontrado')
    }
    setManualTicket('')
    setTimeout(() => setScanResult(null), 5000)
  }

  const handleCreateCoupon = async () => {
    // Validate with Zod
    const parsed = couponSchema.safeParse({
      code: couponForm.code,
      discount_type: couponForm.discount_type,
      discount_value: Number(couponForm.discount_value) || 0,
      event_id: couponForm.event_id || undefined,
      max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : undefined,
      valid_until: couponForm.valid_until || undefined,
    })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      parsed.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message
      })
      setCouponErrors(fieldErrors)
      return
    }
    setCouponErrors({})
    setCouponSubmitting(true)
    try {
      const result = await createCouponAction(parsed.data)
      if (result.success) {
        const newCoupon: Coupon = {
          id: result.data?.id || crypto.randomUUID(),
          code: parsed.data.code,
          discount_type: parsed.data.discount_type,
          discount_value: parsed.data.discount_value,
          used_count: 0,
          max_uses: parsed.data.max_uses || undefined,
          is_active: true,
          event_id: parsed.data.event_id || undefined,
          valid_until: parsed.data.valid_until || undefined,
          created_at: new Date().toISOString(),
        }
        setCupones(prev => [newCoupon, ...prev])
        setShowCouponModal(false)
        setCouponForm({ code: '', discount_type: 'percentage', discount_value: '', event_id: '', max_uses: '', valid_until: '' })
        toast.success('Cupón creado exitosamente')
      } else {
        toast.error(result.error || 'Error al crear el cupón')
      }
    } catch {
      toast.error('Error al crear el cupón')
    } finally {
      setCouponSubmitting(false)
    }
  }

  const eventosUnicos = [...new Set(checkins.map(c => c.event_name))]
  const historialFiltrado = checkins.filter(c => {
    if (filtroEvento && c.event_name !== filtroEvento) return false
    if (busqueda && !c.customer_name.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  // Pagination
  const totalPages = Math.ceil(historialFiltrado.length / PAGE_SIZE)
  const paginatedCheckins = historialFiltrado.slice(checkinPage * PAGE_SIZE, (checkinPage + 1) * PAGE_SIZE)
  const showFrom = historialFiltrado.length > 0 ? checkinPage * PAGE_SIZE + 1 : 0
  const showTo = Math.min((checkinPage + 1) * PAGE_SIZE, historialFiltrado.length)

  const totalOk = checkins.filter(c => c.status === 'success' || c.status === 'valid').length
  const totalFail = checkins.length - totalOk
  const avgPerHour = checkins.length > 0 ? Math.round(checkins.length / Math.max(1, new Set(checkins.map(c => new Date(c.scanned_at).getHours())).size)) : 0

  // Stats by event
  const byEvent = checkins.reduce((a, c) => { a[c.event_name] = (a[c.event_name] || 0) + 1; return a }, {} as Record<string, number>)
  const eventStats = Object.entries(byEvent).map(([n, c]) => ({ name: n, count: c, pct: Math.round((c / checkins.length) * 100) })).sort((a, b) => b.count - a.count).slice(0, 5)

  // Ticket stats
  const ticketsByStatus = tickets.reduce((a, t) => { a[t.status] = (a[t.status] || 0) + 1; return a }, {} as Record<string, number>)

  const hasNotifications = notificationLogs.length > 0

  // Filtered notifications
  const displayedNotifs = notifFilter
    ? notificationLogs.filter(l => l.action.toLowerCase().includes('notification') || l.action.toLowerCase().includes('email'))
    : notificationLogs

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      <div className="bg-gray-200 rounded-xl h-64" />
      <div className="bg-white rounded-lg p-3 sm:p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-10 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg p-3 sm:p-4 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          {[1,2,3,4,5].map(i => <div key={i} className="h-6 bg-gray-100 rounded" />)}
        </div>
        <div className="bg-white rounded-lg p-3 sm:p-4 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 rounded" />)}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Sub-tabs Navigation */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          {['checkins', 'reservas', 'boletos', 'clientes', 'cupones'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-[#EF4444] text-[#EF4444] bg-red-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'checkins' ? 'Check-ins' :
               tab === 'reservas' ? 'Reservas' :
               tab === 'boletos' ? 'Boletos' :
               tab === 'clientes' ? 'Clientes' :
               'Cupones'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-3 sm:p-4">
          {/* Check-ins Tab */}
          {activeTab === 'checkins' && (
            <div className="space-y-4">
              {/* Scanner Section — Hero */}
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-3 sm:p-4 text-white">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left: Scanner */}
                  <div className="lg:col-span-1">
                    <h2 className="text-xs sm:text-sm font-bold mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      ESCÁNER ACTIVO
                    </h2>
                    {cameraActive ? (
                      <div className="relative">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-[4/3] rounded-lg bg-black object-cover" />
                        <div className="absolute inset-0 border-2 border-[#E63946] rounded-lg pointer-events-none">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 sm:w-32 h-24 sm:h-32 border-2 border-white/40 rounded-lg" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-24 sm:h-32 bg-[#E63946]/30 animate-pulse" />
                        </div>
                        <button onClick={stopCamera} className="absolute bottom-2 right-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">
                          Cerrar Cámara
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualTicket}
                            onChange={e => setManualTicket(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleManualScan()}
                            placeholder="TKT-2026-0001 o token..."
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#E63946]"
                          />
                          <button onClick={handleManualScan} className="px-3 py-2 bg-[#E63946] rounded-lg text-xs font-bold hover:bg-[#c5303c] transition-colors">Validar</button>
                        </div>
                        <button onClick={startCamera} className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2">
                          📷 Abrir Cámara QR
                        </button>
                      </div>
                    )}
                    {scanResult && (
                      <div className={`mt-2 p-2 rounded-lg text-xs sm:text-sm font-medium ${scanResult.ok ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {scanResult.ok ? '✅' : '❌'} {scanResult.msg}
                      </div>
                    )}
                  </div>

                  {/* Right: Live stats */}
                  <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-white/10 rounded-lg p-2 sm:p-3">
                      <p className="text-white/50 text-[9px] sm:text-[10px] uppercase font-semibold">Check-ins</p>
                      <p className="text-xl sm:text-2xl font-bold">{checkins.length}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-2 sm:p-3">
                      <p className="text-white/50 text-[9px] sm:text-[10px] uppercase font-semibold">Exitosos</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-400">{totalOk}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-2 sm:p-3">
                      <p className="text-white/50 text-[9px] sm:text-[10px] uppercase font-semibold">Fallidos</p>
                      <p className="text-xl sm:text-2xl font-bold text-red-400">{totalFail}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-2 sm:p-3">
                      <p className="text-white/50 text-[9px] sm:text-[10px] uppercase font-semibold">Prom/Hora</p>
                      <p className="text-xl sm:text-2xl font-bold">{avgPerHour}</p>
                    </div>

                    {/* Ticket inventory */}
                    <div className="col-span-2 sm:col-span-4 bg-white/5 rounded-lg p-2 sm:p-3">
                      <p className="text-white/50 text-[9px] sm:text-[10px] uppercase font-semibold mb-2">Inventario de Boletos</p>
                      <div className="flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Válidos: {ticketsByStatus['valid'] || 0}</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Usados: {ticketsByStatus['used'] || 0}</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Pendientes: {ticketsByStatus['pending'] || 0}</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Cancelados: {ticketsByStatus['cancelled'] || 0}</span>
                      </div>
                      <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden flex">
                        {tickets.length > 0 && <>
                          <div className="h-full bg-green-400" style={{ width: `${((ticketsByStatus['valid'] || 0) / tickets.length) * 100}%` }} />
                          <div className="h-full bg-blue-400" style={{ width: `${((ticketsByStatus['used'] || 0) / tickets.length) * 100}%` }} />
                          <div className="h-full bg-yellow-400" style={{ width: `${((ticketsByStatus['pending'] || 0) / tickets.length) * 100}%` }} />
                          <div className="h-full bg-red-400" style={{ width: `${((ticketsByStatus['cancelled'] || 0) / tickets.length) * 100}%` }} />
                        </>}
                      </div>
                    </div>

                    {/* Check-ins by event bars */}
                    <div className="col-span-2 sm:col-span-4 bg-white/5 rounded-lg p-2 sm:p-3">
                      <p className="text-white/50 text-[9px] sm:text-[10px] uppercase font-semibold mb-2">Check-ins por Evento</p>
                      <div className="space-y-1.5">
                        {eventStats.map(e => (
                          <div key={e.name} className="flex items-center gap-2">
                            <span className="text-[10px] sm:text-xs w-20 sm:w-24 truncate text-white/70">{e.name}</span>
                            <div className="flex-1 h-2 sm:h-2.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[#E63946]" style={{ width: `${e.pct}%` }} />
                            </div>
                            <span className="text-[10px] sm:text-xs text-white/50 w-12 sm:w-14 text-right">{e.count} ({e.pct}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Check-ins History Table */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="text-sm font-extrabold">Historial de Check-ins</h3>
                  <div className="flex gap-2">
                    <select value={filtroEvento} onChange={e => { setFiltroEvento(e.target.value); setCheckinPage(0) }} className="px-2 py-1 border border-gray-200 rounded text-xs flex-1 sm:flex-none">
                      <option value="">Todos</option>
                      {eventosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => { setBusqueda(e.target.value); setCheckinPage(0) }} className="px-2 py-1 border border-gray-200 rounded text-xs w-24 sm:w-28" />
                  </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left py-1.5 px-2 sm:px-3 font-semibold text-gray-600">Ticket</th>
                        <th className="text-left py-1.5 px-2 sm:px-3 font-semibold text-gray-600">Cliente</th>
                        <th className="text-left py-1.5 px-2 sm:px-3 font-semibold text-gray-600 hidden sm:table-cell">Evento</th>
                        <th className="text-left py-1.5 px-2 sm:px-3 font-semibold text-gray-600">Hora</th>
                        <th className="text-left py-1.5 px-2 sm:px-3 font-semibold text-gray-600"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCheckins.map((c, i) => (
                        <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="py-1.5 px-2 sm:px-3 font-mono text-[#E63946]">{c.ticket_number}</td>
                          <td className="py-1.5 px-2 sm:px-3 truncate max-w-[80px] sm:max-w-none">{c.customer_name}</td>
                          <td className="py-1.5 px-2 sm:px-3 text-gray-600 hidden sm:table-cell truncate max-w-[100px]">{c.event_name}</td>
                          <td className="py-1.5 px-2 sm:px-3 text-gray-500">{formatTime(c.scanned_at)}</td>
                          <td className="py-1.5 px-2 sm:px-3">
                            <span className={c.status === 'success' || c.status === 'valid' ? 'text-green-500' : 'text-red-500'}>
                              {c.status === 'success' || c.status === 'valid' ? '✓' : '✗'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {historialFiltrado.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-sm">Sin registros</td></tr>}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {historialFiltrado.length > PAGE_SIZE && (
                  <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>{showFrom}-{showTo} de {historialFiltrado.length}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCheckinPage(p => Math.max(0, p - 1))}
                        disabled={checkinPage === 0}
                        className="px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ← Ant
                      </button>
                      <button
                        onClick={() => setCheckinPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={checkinPage >= totalPages - 1}
                        className="px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Sig →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reservas Tab */}
          {activeTab === 'reservas' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-[#1E293B]">Reservas</h2>
                  <p className="text-sm text-gray-600">Total: {reservas.length.toLocaleString()}</p>
                </div>
                <input
                  type="text"
                  placeholder="Buscar evento o cliente..."
                  value={reservasSearch}
                  onChange={e => setReservasSearch(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded text-xs sm:text-sm focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
                />
              </div>

              {/* Status breakdown */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-green-600 font-bold text-sm">ACTIVE</p>
                  <p className="text-2xl font-bold text-green-700">{reservas.filter(r => r[reservasHeaders.indexOf('Estado')] === 'ACTIVE').length}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-blue-600 font-bold text-sm">CONFIRMED</p>
                  <p className="text-2xl font-bold text-blue-700">{reservas.filter(r => r[reservasHeaders.indexOf('Estado')] === 'CONFIRMED').length}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-600 font-bold text-sm">EXPIRED</p>
                  <p className="text-2xl font-bold text-gray-700">{reservas.filter(r => r[reservasHeaders.indexOf('Estado')] === 'EXPIRED').length}</p>
                </div>
              </div>

              {/* Reservas Table */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Evento</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Cliente</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Tipo de Boleto</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Cantidad</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservas
                        .filter(r => {
                          if (!reservasSearch) return true
                          const evento = parseEventoName(r[reservasHeaders.indexOf('Evento')] || '')
                          const cliente = parseClienteName(r[reservasHeaders.indexOf('Cliente')] || '')
                          return evento.toLowerCase().includes(reservasSearch.toLowerCase()) ||
                                 cliente.toLowerCase().includes(reservasSearch.toLowerCase())
                        })
                        .slice(reservasPage * PAGE_SIZE, (reservasPage + 1) * PAGE_SIZE)
                        .map((reserva, i) => (
                          <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3 truncate max-w-[150px]" title={reserva[reservasHeaders.indexOf('Evento')]}>
                              {parseEventoName(reserva[reservasHeaders.indexOf('Evento')] || '')}
                            </td>
                            <td className="py-2 px-3 truncate max-w-[120px]">
                              {parseClienteName(reserva[reservasHeaders.indexOf('Cliente')] || '')}
                            </td>
                            <td className="py-2 px-3">{reserva[reservasHeaders.indexOf('Tipo de Boleto')] || ''}</td>
                            <td className="py-2 px-3 font-bold">{reserva[reservasHeaders.indexOf('Cantidad')] || ''}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
                                reserva[reservasHeaders.indexOf('Estado')] === 'ACTIVE' ? 'bg-green-500' :
                                reserva[reservasHeaders.indexOf('Estado')] === 'CONFIRMED' ? 'bg-blue-500' :
                                'bg-gray-400'
                              }`}>
                                {reserva[reservasHeaders.indexOf('Estado')] || ''}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Boletos Tab */}
          {activeTab === 'boletos' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-[#1E293B]">Boletos</h2>
                  <p className="text-sm text-gray-600">Total: {boletos.length.toLocaleString()}</p>
                </div>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={boletosSearch}
                  onChange={e => setBoletosSearch(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded text-xs sm:text-sm focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
                />
              </div>

              {/* Status breakdown */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-green-600 font-bold text-sm">VALID</p>
                  <p className="text-xl font-bold text-green-700">{boletos.filter(b => b[boletosHeaders.indexOf('Estado')] === 'VALID').length}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-blue-600 font-bold text-sm">USED</p>
                  <p className="text-xl font-bold text-blue-700">{boletos.filter(b => b[boletosHeaders.indexOf('Estado')] === 'USED').length}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-red-600 font-bold text-sm">EXPIRED</p>
                  <p className="text-xl font-bold text-red-700">{boletos.filter(b => b[boletosHeaders.indexOf('Estado')] === 'EXPIRED').length}</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <p className="text-orange-600 font-bold text-sm">REFUNDED</p>
                  <p className="text-xl font-bold text-orange-700">{boletos.filter(b => b[boletosHeaders.indexOf('Estado')] === 'REFUNDED').length}</p>
                </div>
              </div>

              {/* Boletos Table */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Boleto ID</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Evento</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Cliente</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Tipo</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Monto</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {boletos
                        .filter(b => {
                          if (!boletosSearch) return true
                          const searchLower = boletosSearch.toLowerCase()
                          return Object.values(b).some(val =>
                            String(val).toLowerCase().includes(searchLower)
                          )
                        })
                        .slice(boletosPage * PAGE_SIZE, (boletosPage + 1) * PAGE_SIZE)
                        .map((boleto, i) => (
                          <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3 font-mono text-[#EF4444] text-[11px]">
                              {String(boleto[boletosHeaders.indexOf('Boleto')] || '').substring(0, 8)}...
                            </td>
                            <td className="py-2 px-3 truncate max-w-[120px]">
                              {parseEventoName(boleto[boletosHeaders.indexOf('Evento')] || '')}
                            </td>
                            <td className="py-2 px-3 truncate max-w-[100px]">
                              {parseClienteName(boleto[boletosHeaders.indexOf('Cliente')] || '')}
                            </td>
                            <td className="py-2 px-3">{boleto[boletosHeaders.indexOf('Tipo')] || ''}</td>
                            <td className="py-2 px-3 font-bold">
                              ${parseMonto(boleto[boletosHeaders.indexOf('Monto')] || '0').toLocaleString()}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
                                boleto[boletosHeaders.indexOf('Estado')] === 'VALID' ? 'bg-green-500' :
                                boleto[boletosHeaders.indexOf('Estado')] === 'USED' ? 'bg-blue-500' :
                                boleto[boletosHeaders.indexOf('Estado')] === 'EXPIRED' ? 'bg-red-500' :
                                boleto[boletosHeaders.indexOf('Estado')] === 'REFUNDED' ? 'bg-orange-500' :
                                'bg-gray-400'
                              }`}>
                                {boleto[boletosHeaders.indexOf('Estado')] || ''}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Clientes Tab */}
          {activeTab === 'clientes' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1E293B]">Búsqueda de Clientes</h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCustomerSearch()}
                  placeholder="Buscar por nombre o email..."
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-xs sm:text-sm focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
                />
                <button
                  onClick={handleCustomerSearch}
                  className="px-3 py-1.5 bg-[#EF4444] text-white rounded text-xs sm:text-sm font-bold hover:bg-red-600"
                >
                  Buscar
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {searchResults.map(customer => (
                    <div key={customer.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div
                        onClick={() => setExpandedCustomer(expandedCustomer === customer.id ? null : customer.id)}
                        className="p-2 sm:p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs sm:text-sm font-bold text-gray-500">
                              {customer.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-extrabold text-xs sm:text-sm">{customer.name}</p>
                              <p className="text-[10px] sm:text-xs text-gray-500">{customer.email}</p>
                              {customer.phone && <p className="text-[10px] text-gray-400">{customer.phone}</p>}
                              <div className="flex gap-2 mt-1 text-[10px]">
                                <span className="text-green-600 font-bold">
                                  ${(customer.total_spent || 0).toLocaleString()}
                                </span>
                                <span className="text-blue-600">
                                  {customer.total_orders} órdenes
                                </span>
                              </div>
                              {customer.first_purchase_at && (
                                <p className="text-[9px] text-gray-400">
                                  Cliente desde {new Date(customer.first_purchase_at).toLocaleDateString('es-MX')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="text-[10px] sm:text-xs text-gray-400 bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded-full font-bold">
                              {customer.total_orders} boleto{customer.total_orders !== 1 ? 's' : ''}
                            </span>
                            <svg className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${expandedCustomer === customer.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>
                      </div>
                      <div
                        className="overflow-hidden transition-all duration-300 ease-in-out"
                        style={{ maxHeight: expandedCustomer === customer.id ? '500px' : '0px', opacity: expandedCustomer === customer.id ? 1 : 0 }}
                      >
                        <div className="border-t border-gray-100 bg-gray-50 p-3">
                          <p className="text-xs font-bold text-gray-600 mb-2">Historial de boletos</p>
                          {(customer as any).tickets?.length > 0 ? (
                            <div className="space-y-1.5">
                              {(customer as any).tickets.map((ticket: Ticket, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-white rounded p-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[#EF4444] font-bold">{ticket.ticket_number}</span>
                                    <span className="text-gray-500 hidden sm:inline">{ticket.zone_name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400 hidden sm:inline">{new Date(ticket.created_at).toLocaleDateString('es-MX')}</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${
                                      ticket.status === 'valid' ? 'bg-green-500' :
                                      ticket.status === 'used' ? 'bg-blue-500' : 'bg-yellow-500'
                                    }`}>
                                      {ticket.status === 'valid' ? 'Válido' : ticket.status === 'used' ? 'Usado' : 'Pendiente'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 text-center py-2">Sin boletos</p>
                          )}
                          <div className="mt-2 pt-2 border-t border-gray-200 flex justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer); }}
                              className="text-xs text-[#EF4444] font-bold hover:underline"
                            >
                              Ver perfil completo
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {customerSearch && searchResults.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">No se encontraron clientes</p>
              )}
            </div>
          )}

          {/* Cupones Tab */}
          {activeTab === 'cupones' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-[#1E293B]">Cupones</h2>
                <button
                  onClick={() => setShowCouponModal(true)}
                  className="px-3 py-1.5 text-white rounded text-xs font-bold hover:opacity-90 transition-opacity bg-[#EF4444]"
                >
                  + Crear Cupón
                </button>
              </div>

              <div className="space-y-3">
                {cupones.map(c => {
                  const usagePercent = c.max_uses ? (c.used_count / c.max_uses) * 100 : 0
                  const barColor = usagePercent < 50 ? 'bg-green-500' : usagePercent < 80 ? 'bg-yellow-500' : 'bg-red-500'
                  const totalDiscountValue = c.discount_type === 'fixed'
                    ? c.used_count * c.discount_value
                    : c.used_count * (c.discount_value * 0.01 * 300) // estimated based on avg ticket price

                  return (
                    <div key={c.id} className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-sm">{c.code}</span>
                          <span className="px-2 py-0.5 text-xs rounded bg-gray-100 font-bold">
                            {c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${c.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <p>Descuento total: <span className="font-bold">${totalDiscountValue.toLocaleString()}</span></p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-600 whitespace-nowrap">
                          {c.used_count}/{c.max_uses || '∞'} ({Math.round(usagePercent)}%)
                        </span>
                      </div>
                    </div>
                  )
                })}
                {cupones.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p>No hay cupones disponibles</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification Log - outside tabs */}
      {hasNotifications && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold">Log de Notificaciones</h3>
            <button
              onClick={() => setNotifFilter(!notifFilter)}
              className={`px-2 py-1 rounded text-xs font-bold transition-colors ${notifFilter ? 'bg-[#EF4444] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {notifFilter ? 'Mostrar todo' : 'Filtros'}
            </button>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            <div className="divide-y divide-gray-50">
              {displayedNotifs.map(log => (
                <div key={log.id} className="px-3 py-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900">{log.action}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{log.user_email}</p>
                      <p className="text-xs text-gray-400">{formatTime(log.created_at)}</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1"></span>
                  </div>
                  {log.details && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{log.details}</p>
                  )}
                </div>
              ))}
              {displayedNotifs.length === 0 && (
                <div className="py-6 text-center text-gray-400 text-xs">Sin notificaciones</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Coupon Create Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCouponModal(false)}>
          <div className="bg-white rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base sm:text-lg font-extrabold text-gray-900 mb-4">Crear Cupón</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Código del cupón</label>
                <input
                  type="text"
                  value={couponForm.code}
                  onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="VERANO2026"
                  className={"w-full px-3 py-2 border rounded-lg text-sm uppercase focus:outline-none focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] " + (couponErrors.code ? 'border-red-400' : 'border-gray-200')}
                />
                {couponErrors.code && <p className="text-xs text-red-500 mt-1">{couponErrors.code}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Tipo de descuento</label>
                <select
                  value={couponForm.discount_type}
                  onChange={e => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946]"
                >
                  <option value="percentage">Porcentaje</option>
                  <option value="fixed">Monto fijo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Valor</label>
                <input
                  type="number"
                  value={couponForm.discount_value}
                  onChange={e => setCouponForm({ ...couponForm, discount_value: e.target.value })}
                  placeholder={couponForm.discount_type === 'percentage' ? '15' : '100'}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Evento asociado</label>
                <select
                  value={couponForm.event_id}
                  onChange={e => setCouponForm({ ...couponForm, event_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946]"
                >
                  <option value="">Todos los eventos</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Límite de uso</label>
                <input
                  type="number"
                  value={couponForm.max_uses}
                  onChange={e => setCouponForm({ ...couponForm, max_uses: e.target.value })}
                  placeholder="100"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Fecha de expiración</label>
                <input
                  type="date"
                  value={couponForm.valid_until}
                  onChange={e => setCouponForm({ ...couponForm, valid_until: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946]"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowCouponModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCoupon}
                disabled={!couponForm.code || !couponForm.discount_value || couponSubmitting}
                className="px-4 py-2 text-white rounded-lg text-sm font-bold disabled:opacity-40 flex items-center gap-2"
                style={{ backgroundColor: ACCENT }}
              >
                {couponSubmitting && <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                Crear Cupón
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Modal - Enhanced */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-extrabold text-[#1E293B]">Perfil del Cliente</h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Customer Info Card */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-[#EF4444]/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-[#EF4444]">
                      {selectedCustomer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-extrabold text-lg text-gray-900">
                      {selectedCustomer.name} {selectedCustomer.last_name || ''}
                    </h4>
                    <p className="text-sm text-gray-600 mt-0.5">{selectedCustomer.email}</p>
                    {selectedCustomer.phone && (
                      <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <div className="text-center p-2 bg-white rounded">
                        <p className="text-lg font-bold text-[#EF4444]">
                          ${(selectedCustomer.total_spent || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">Total Gastado</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <p className="text-lg font-bold text-blue-600">{selectedCustomer.total_orders || 0}</p>
                        <p className="text-xs text-gray-500">Órdenes</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <p className="text-xs font-bold text-gray-700">
                          {selectedCustomer.first_purchase_at
                            ? new Date(selectedCustomer.first_purchase_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
                            : 'N/A'
                          }
                        </p>
                        <p className="text-xs text-gray-500">Primera Compra</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <p className="text-xs font-bold text-gray-700">
                          {selectedCustomer.last_purchase_at
                            ? new Date(selectedCustomer.last_purchase_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
                            : 'N/A'
                          }
                        </p>
                        <p className="text-xs text-gray-500">Última Compra</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase History Table */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                  <span>📋</span> Historial de Compras y Boletos
                </h4>

                {(selectedCustomer as any).tickets?.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3 font-semibold text-gray-600">Boleto</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-600">Zona</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-600">Fecha</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-600">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedCustomer as any).tickets.map((ticket: Ticket, index: number) => (
                            <tr key={index} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-3">
                                <span className="font-mono text-[#EF4444] font-bold text-[11px]">
                                  {ticket.ticket_number}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-gray-600">{ticket.zone_name}</td>
                              <td className="py-2 px-3 text-gray-500">
                                {new Date(ticket.created_at).toLocaleDateString('es-MX')}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
                                  ticket.status === 'valid' ? 'bg-green-500' :
                                  ticket.status === 'used' ? 'bg-blue-500' :
                                  ticket.status === 'expired' ? 'bg-red-500' :
                                  'bg-yellow-500'
                                }`}>
                                  {ticket.status === 'valid' ? 'Válido' :
                                   ticket.status === 'used' ? 'Usado' :
                                   ticket.status === 'expired' ? 'Expirado' : 'Pendiente'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                    <p>Este cliente no tiene historial de compras</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => toast.info('Próximamente: envío de email al cliente')}
                  className="px-4 py-2 bg-[#EF4444] text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-red-600 transition-colors"
                >
                  📧 Enviar Email
                </button>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 text-xs sm:text-sm font-bold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
