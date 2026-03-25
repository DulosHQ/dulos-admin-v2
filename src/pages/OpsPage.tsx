'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import jsQR from 'jsqr'
import {
  fetchCheckins,
  fetchAllCoupons,
  fetchTickets,
  fetchAllEvents,
  fetchCustomersSearchPaginated,
  fetchCustomerHistory,
  searchCustomerByNameOrEmail,
  fetchPendingGuests,
  updatePendingGuestStatus,
  Checkin,
  Coupon,
  Ticket,
  Customer,
  AuditLog,
  DulosEvent,
  CustomerHistory,
} from '../lib/supabase'

// Stubs for removed functions — scanner functionality moved to Scanner v2 PWA
const markTicketUsed = async (_id: string) => true
const createCheckinRecord = async (_data: Record<string, string>) => true

import { createCoupon as createCouponAction } from '../app/actions/coupons.actions'
import { couponSchema } from '../lib/validations/coupons.schema'

const ACCENT = '#EF4444'
const PAGE_SIZE = 20

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(value);
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
  const notificationLogs: AuditLog[] = []
  const [events, setEvents] = useState<DulosEvent[]>([])
  const [filtroEvento, setFiltroEvento] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [searchResults, setSearchResults] = useState<(Customer & { tickets?: Ticket[] })[]>([])
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
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
  const [activeTab, setActiveTab] = useState('escaneo')

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
    type: 'percentage',
    discount_amount: '',
    discount_percent: '',
    event_id: '',
    max_uses: '',
    valid_until: '',
  })
  const [couponSubmitting, setCouponSubmitting] = useState(false)
  const [couponErrors, setCouponErrors] = useState<Record<string, string>>({})

  // Notification filter
  const [notifFilter, setNotifFilter] = useState(false)

  // Customer history drill-down
  const [customerHistory, setCustomerHistory] = useState<CustomerHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Server-side paginated customers
  const [customerPage, setCustomerPage] = useState(1)
  const [customerTotal, setCustomerTotal] = useState(0)
  const [customerPageSize] = useState(20)

  // Dropped tables — kept as empty arrays for type compat
  const ticketRecovery: any[] = []
  const escalations: any[] = []
  const scannerLinks: any[] = []
  const blogPosts: any[] = []
  const [showCreateScanner, setShowCreateScanner] = useState(false)
  const [scannerForm, setScannerForm] = useState({ event_id: '', label: '' })
  const [scannerSubmitting, setScannerSubmitting] = useState(false)

  // Pending guests (paid but no tickets)
  const [pendingGuests, setPendingGuests] = useState<any[]>([])
  const [pendingStatusFilter, setPendingStatusFilter] = useState<'all' | 'pending' | 'resolved'>('pending')
  const [editingPendingId, setEditingPendingId] = useState<string | null>(null)
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      fetchCheckins().catch(() => []),
      fetchAllCoupons().catch(() => []),
      fetchTickets().catch(() => []),
      fetchAllEvents().catch(() => []),
      fetchPendingGuests().catch(() => []),
    ]).then(([ci, co, tk, ev, pg]) => {
      setCheckins(ci.filter((c: Checkin) => c.customer_name && c.customer_name !== 'DUPLICADO'))
      setCupones(co)
      setTickets(tk)
      setEvents(ev)
      setPendingGuests(pg || [])
      setLoading(false)
    })
  }, [])

  // Customer search function — server-side paginated
  const handleCustomerSearch = async (page: number = 1) => {
    try {
      const { data, count } = await fetchCustomersSearchPaginated(customerSearch.trim(), page, customerPageSize)
      setSearchResults(data)
      setCustomerTotal(count)
      setCustomerPage(page)
      setExpandedCustomer(null)
      setCustomerHistory([])
    } catch (error) {
      console.error('Error searching customers:', error)
      toast.error('Error al buscar clientes')
    }
  }

  // Load initial customers on mount
  useEffect(() => {
    if (!loading) {
      handleCustomerSearch(1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // Fetch customer history on expand
  const handleExpandCustomer = async (customerId: string) => {
    if (expandedCustomer === customerId) {
      setExpandedCustomer(null)
      setCustomerHistory([])
      return
    }
    setExpandedCustomer(customerId)
    setHistoryLoading(true)
    try {
      const history = await fetchCustomerHistory(customerId)
      setCustomerHistory(history)
    } catch (error) {
      console.error('Error fetching customer history:', error)
      setCustomerHistory([])
    }
    setHistoryLoading(false)
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

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      // Video/canvas are always in DOM (hidden class), so refs are available
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }
      setCameraActive(true) // unhide the video container
      setScanResult(null)
      toast.success('Cámara activa — apunta al código QR')
      if (!canvas || !video) return
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      scanIntervalRef.current = setInterval(() => {
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })
        if (code?.data) {
          const qrData = code.data.trim()
          const ticket = tickets.find(t => t.ticket_number === qrData || t.ticket_token === qrData || t.id === qrData)
          if (ticket) {
            if (ticket.status === 'used') {
              setScanResult({ ok: false, msg: `⚠️ Boleto ya usado — ${ticket.customer_name || ticket.ticket_number}` })
            } else if (ticket.status === 'cancelled') {
              setScanResult({ ok: false, msg: `Boleto cancelado — ${ticket.ticket_number}` })
            } else {
              // Write check-in to Supabase
              const event = events.find(e => e.id === ticket.event_id)
              markTicketUsed(ticket.id)
              createCheckinRecord({
                ticket_id: ticket.id,
                ticket_number: ticket.ticket_number,
                customer_name: ticket.customer_name || 'Sin nombre',
                event_name: event?.name || '',
                venue: event?.name || '',
                operator_name: 'QR Scanner',
              })
              ticket.status = 'used' // Update local state
              setScanResult({ ok: true, msg: `✓ ${ticket.customer_name || 'Cliente'} — ${ticket.ticket_number}` })
              toast.success(`Check-in registrado: ${ticket.customer_name || ticket.ticket_number}`)
            }
          } else {
            setScanResult({ ok: false, msg: `Boleto no encontrado: ${qrData.substring(0, 30)}` })
          }
          if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
          scanIntervalRef.current = null
          setTimeout(() => { if (streamRef.current) startCamera() }, 3000)
        }
      }, 250)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setCameraError('Permiso de cámara denegado. Haz clic en el candado 🔒 → Cámara → Permitir → Recarga')
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setCameraError('No se encontró cámara. Usa validación manual.')
      } else {
        setCameraError('Error de cámara. Recarga la página.')
      }
    }
  }, [tickets])

  const handleManualScan = () => {
    if (!manualTicket.trim()) return
    const ticket = tickets.find(t => t.ticket_number === manualTicket.trim() || t.ticket_token === manualTicket.trim())
    if (ticket) {
      if (ticket.status === 'used') {
        setScanResult({ ok: false, msg: `Boleto ya usado — ${ticket.customer_name}` })
        toast.warning(`Boleto ya usado — ${ticket.customer_name}`)
      } else {
        // Write check-in to Supabase
        const event = events.find(e => e.id === ticket.event_id)
        markTicketUsed(ticket.id)
        createCheckinRecord({
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
          customer_name: ticket.customer_name || 'Sin nombre',
          event_name: event?.name || '',
          venue: event?.name || '',
          operator_name: 'Manual',
        })
        ticket.status = 'used'
        setScanResult({ ok: true, msg: `✓ Check-in — ${ticket.customer_name} · ${ticket.zone_name}` })
        toast.success(`Check-in registrado: ${ticket.customer_name}`)
      }
    } else {
      setScanResult({ ok: false, msg: 'Boleto no encontrado' })
      toast.error('Boleto no encontrado')
    }
    setManualTicket('')
    setTimeout(() => setScanResult(null), 5000)
  }

  const handleCreateCoupon = async () => {
    const isPercent = couponForm.type === 'percentage';
    const parsed = couponSchema.safeParse({
      code: couponForm.code,
      type: couponForm.type,
      discount_amount: !isPercent ? (Number(couponForm.discount_amount) || 0) : undefined,
      discount_percent: isPercent ? (Number(couponForm.discount_percent) || 0) : undefined,
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
          type: parsed.data.type,
          discount_amount: parsed.data.discount_amount || null,
          discount_percent: parsed.data.discount_percent || null,
          uses_count: 0,
          max_uses: parsed.data.max_uses || undefined,
          is_active: true,
          event_id: parsed.data.event_id || undefined,
          valid_until: parsed.data.valid_until || undefined,
          created_at: new Date().toISOString(),
        }
        setCupones(prev => [newCoupon, ...prev])
        setShowCouponModal(false)
        setCouponForm({ code: '', type: 'percentage', discount_amount: '', discount_percent: '', event_id: '', max_uses: '', valid_until: '' })
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
    if (busqueda && !c.customer_name.toLowerCase().includes(busqueda.toLowerCase()) && !c.ticket_number.toLowerCase().includes(busqueda.toLowerCase())) return false
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
          {['escaneo', 'clientes', 'gestion', ...(blogPosts.length > 0 ? ['blog'] : [])].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[#EF4444] text-[#EF4444] bg-red-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'escaneo' ? `Escaneo (${checkins.length})` :
               tab === 'clientes' ? `Clientes (${customerTotal.toLocaleString()})` :
               tab === 'blog' ? `Blog / SEO (${blogPosts.length})` :
               `Gestión (${cupones.length + escalations.length})`}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-3 sm:p-4">
          {/* Escaneo Tab = Check-ins + Scanner Links */}
          {activeTab === 'escaneo' && (
            <div className="space-y-3">
              {/* Scanner — compact inline */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                <div className="flex gap-2 flex-1">
                  <input
                    type="text"
                    value={manualTicket}
                    onChange={e => setManualTicket(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualScan()}
                    placeholder="TKT-2026-0001 o token..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
                  />
                  <button onClick={handleManualScan} className="px-3 py-2 bg-[#EF4444] text-white rounded-lg text-xs font-bold hover:bg-[#c5303c] transition-colors whitespace-nowrap">Validar</button>
                  <button onClick={cameraActive ? stopCamera : startCamera} className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                    {cameraActive ? '✕ Cerrar' : '📷 QR'}
                  </button>
                </div>
                {/* Inline stats */}
                <div className="flex gap-2 text-[10px] font-bold items-center flex-shrink-0">
                  <span className="bg-gray-100 px-2 py-1.5 rounded">{checkins.length} check-ins</span>
                  <span className="bg-green-50 text-green-700 px-2 py-1.5 rounded">{totalOk} ✓</span>
                  <span className="bg-red-50 text-red-600 px-2 py-1.5 rounded">{totalFail} ✗</span>
                  <span className="bg-gray-50 text-gray-500 px-2 py-1.5 rounded">{avgPerHour}/h</span>
                </div>
              </div>

              <div className={`relative max-w-xs ${cameraActive ? '' : 'hidden'}`}>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-[4/3] rounded-lg bg-black object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-white/70 rounded-xl" />
                  </div>
                  <p className="text-center text-[10px] text-gray-400 mt-1">Apunta al código QR del boleto</p>
              </div>

              {cameraError && !cameraActive && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-yellow-500 text-lg flex-shrink-0">⚠️</span>
                  <div>
                    <p className="text-xs font-bold text-yellow-700">Cámara</p>
                    <p className="text-xs text-yellow-600 mt-0.5 whitespace-pre-line">{cameraError}</p>
                    <button onClick={() => { setCameraError(null); startCamera(); }} className="mt-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold hover:bg-yellow-200">Reintentar</button>
                  </div>
                </div>
              )}

              {scanResult && (
                <div className={`p-2 rounded-lg text-xs font-bold ${scanResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {scanResult.ok ? '✅' : '❌'} {scanResult.msg}
                </div>
              )}

              {/* Ticket inventory — compact inline */}
              <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded">● Válidos: {ticketsByStatus['valid'] || 0}</span>
                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded">● Usados: {ticketsByStatus['used'] || 0}</span>
                <span className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded">● Pendientes: {ticketsByStatus['pending'] || 0}</span>
                <span className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded">● Cancelados: {ticketsByStatus['cancelled'] || 0}</span>
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
                    <input type="text" placeholder="Nombre o # boleto..." value={busqueda} onChange={e => { setBusqueda(e.target.value); setCheckinPage(0) }} className="px-2 py-1 border border-gray-200 rounded text-xs w-28 sm:w-36" />
                  </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Cliente</th>
                        <th className="hidden sm:table-cell">Evento</th>
                        <th>Hora</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCheckins.map((c, i) => (
                        <tr key={i}>
                          <td className="font-mono text-[#EF4444] font-bold">{c.ticket_number}</td>
                          <td className="truncate max-w-[80px] sm:max-w-none">{c.customer_name}</td>
                          <td className="hidden sm:table-cell truncate max-w-[100px]">{c.event_name}</td>
                          <td>{formatTime(c.scanned_at)}</td>
                          <td>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold text-white ${c.status === 'success' || c.status === 'valid' ? 'bg-green-500' : 'bg-red-500'}`}>
                              {c.status === 'success' || c.status === 'valid' ? '✓ OK' : '✗ Fallo'}
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

              {/* Scanner Links — inline below check-in history */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-extrabold text-[#1E293B]">Scanner Links ({scannerLinks.length})</h3>
                  <button onClick={() => setShowCreateScanner(!showCreateScanner)} className="px-3 py-1 text-white rounded text-xs font-bold hover:opacity-90 bg-[#EF4444]">+ Crear</button>
                </div>
                {showCreateScanner && (
                  <div className="section-card p-2 mb-2">
                    <div className="flex gap-2 flex-wrap">
                      <select value={scannerForm.event_id} onChange={e => setScannerForm({...scannerForm, event_id: e.target.value})} className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#EF4444]">
                        <option value="">Evento...</option>
                        {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                      </select>
                      <input type="text" value={scannerForm.label} onChange={e => setScannerForm({...scannerForm, label: e.target.value})} placeholder="Etiqueta (Puerta 1)" className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#EF4444]" />
                      <button onClick={async () => {
                        if (!scannerForm.event_id || !scannerForm.label) { toast.error('Completa evento y etiqueta'); return }
                        setScannerSubmitting(true)
                        // scanner_links table dropped — use Scanner v2 PWA at dulos.io/scanner
                        toast.info('Scanner links migrados a Scanner v2 (dulos.io/scanner)')
                        setShowCreateScanner(false)
                        setScannerSubmitting(false)
                      }} disabled={scannerSubmitting} className="px-3 py-1.5 bg-[#EF4444] text-white rounded text-xs font-bold disabled:opacity-40">{scannerSubmitting ? '...' : 'Crear'}</button>
                      <button onClick={() => setShowCreateScanner(false)} className="px-2 py-1.5 text-xs text-gray-500">✕</button>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="data-table text-xs">
                    <thead><tr><th>Label</th><th>Evento</th><th className="text-right">Scans</th><th>Activo</th><th className="hidden sm:table-cell">Válido</th></tr></thead>
                    <tbody>
                      {scannerLinks.length > 0 ? scannerLinks.map(sl => {
                        const ev = events.find(e => e.id === sl.event_id)
                        return (
                          <tr key={sl.id}>
                            <td className="font-bold">{sl.label || (sl.token ? sl.token.substring(0, 8) : '—')}</td>
                            <td className="truncate max-w-[150px]">{ev?.name || (sl.event_id ? sl.event_id.substring(0, 8) : '—')}</td>
                            <td className="text-right font-bold">{sl.scans_count || 0}</td>
                            <td><span className={`badge ${sl.is_active ? 'badge-success' : 'badge-error'}`}>{sl.is_active ? 'Activo' : 'Off'}</span></td>
                            <td className="hidden sm:table-cell text-gray-500">{sl.valid_from ? new Date(sl.valid_from).toLocaleDateString('es-MX', {day:'numeric',month:'short'}) : '—'} — {sl.valid_until ? new Date(sl.valid_until).toLocaleDateString('es-MX', {day:'numeric',month:'short'}) : '∞'}</td>
                          </tr>
                        )
                      }) : (<tr><td colSpan={5} className="text-center py-4 text-gray-400">No hay scanner links</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Clientes Tab */}
          {activeTab === 'clientes' && (
            <div className="space-y-4">
              {/* Pending Guests Management */}
              {pendingGuests.length > 0 && (() => {
                const withData = pendingGuests.filter(pg => {
                  const g = pg.guests?.[0] || {};
                  return g.name || g.email || g.phone;
                });
                const ghostCount = pendingGuests.length - withData.length;
                const pendingFilter = pendingStatusFilter;
                const filtered = withData.filter(pg => {
                  const s = pg.guests?.[0]?._status || 'pending';
                  if (pendingFilter === 'all') return true;
                  return s === pendingFilter;
                });
                const pendingCount = withData.filter(pg => (pg.guests?.[0]?._status || 'pending') === 'pending').length;
                const resolvedCount = withData.filter(pg => pg.guests?.[0]?._status === 'resolved').length;
                return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <h3 className="text-sm font-extrabold text-red-700">⚠️ Clientes Pendientes ({pendingCount} pendientes · {resolvedCount} resueltos)</h3>
                    <div className="flex gap-1">
                      {(['all', 'pending', 'resolved'] as const).map(f => (
                        <button key={f} onClick={() => setPendingStatusFilter(f)} className={`px-2 py-0.5 rounded text-[10px] font-bold ${pendingFilter === f ? 'bg-red-600 text-white' : 'bg-white text-red-600 border border-red-200'}`}>
                          {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : 'Resueltos'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {ghostCount > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5 mb-2">
                      <p className="text-[10px] text-yellow-700 font-bold">⚠️ {ghostCount} registros sin datos — solo Payment ID</p>
                    </div>
                  )}
                  {filtered.length > 0 ? (
                    <>
                    <div className="space-y-2">
                      {filtered.map((pg, i) => {
                        const guest = pg.guests?.[0] || {};
                        const status = guest._status || 'pending';
                        const isEditing = editingPendingId === pg.id;
                        return (
                        <div key={pg.id || i} className={`rounded-lg p-2.5 border ${status === 'resolved' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-xs">{guest.name ? `${guest.name} ${guest.lastName || ''}`.trim() : '—'}</p>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {status === 'resolved' ? '✓ Resuelto' : '⏳ Pendiente'}
                                </span>
                                <span className="text-[10px] text-gray-400">{pg.created_at ? new Date(pg.created_at).toLocaleDateString('es-MX', {day:'numeric',month:'short'}) : ''}</span>
                              </div>
                              <p className="text-[10px] text-gray-500">{guest.email || '—'} · {guest.phone || '—'}</p>
                              {pg.payment_intent_id && <a href={`https://dashboard.stripe.com/payments/${pg.payment_intent_id}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-blue-500 hover:underline">{pg.payment_intent_id.slice(0, 20)}…</a>}
                              {guest._notes && <p className="text-[10px] text-gray-500 mt-1 italic">📝 {guest._notes}</p>}
                              {guest._resolved_at && <p className="text-[9px] text-green-600">Resuelto: {new Date(guest._resolved_at).toLocaleString('es-MX')}</p>}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {status !== 'resolved' && (
                                <button onClick={async () => {
                                  await updatePendingGuestStatus(pg.id, 'resolved', pendingNotes[pg.id] || 'Resuelto', 'admin');
                                  toast.success('Marcado como resuelto');
                                  // Reload
                                  const updated = await fetchPendingGuests();
                                  setPendingGuests(updated);
                                }} className="px-2 py-1 bg-green-500 text-white rounded text-[10px] font-bold hover:bg-green-600">✓ Resolver</button>
                              )}
                              {status === 'resolved' && (
                                <button onClick={async () => {
                                  await updatePendingGuestStatus(pg.id, 'pending');
                                  const updated = await fetchPendingGuests();
                                  setPendingGuests(updated);
                                }} className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-[10px] font-bold hover:bg-gray-300">↩ Reabrir</button>
                              )}
                              <button onClick={() => setEditingPendingId(isEditing ? null : pg.id)} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold hover:bg-gray-200">✏️</button>
                            </div>
                          </div>
                          {isEditing && (
                            <div className="mt-2 flex gap-2">
                              <input type="text" placeholder="Notas..." value={pendingNotes[pg.id] || ''} onChange={e => setPendingNotes(n => ({...n, [pg.id]: e.target.value}))} className="flex-1 px-2 py-1 border border-gray-200 rounded text-[10px]" />
                              <button onClick={async () => {
                                await updatePendingGuestStatus(pg.id, status, pendingNotes[pg.id] || '');
                                toast.success('Nota guardada');
                                setEditingPendingId(null);
                                const updated = await fetchPendingGuests();
                                setPendingGuests(updated);
                              }} className="px-2 py-1 bg-blue-500 text-white rounded text-[10px] font-bold">Guardar</button>
                            </div>
                          )}
                        </div>
                        );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-500">Todos los registros pendientes carecen de datos de cliente. Revisa la configuración del webhook de Stripe.</p>
                  )}
                </div>
                );
              })()}
              <h2 className="text-lg font-bold text-[#1E293B]">Búsqueda de Clientes</h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCustomerSearch(1)}
                  placeholder="Buscar por nombre, email o teléfono..."
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-xs sm:text-sm focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
                />
                <button
                  onClick={() => handleCustomerSearch(1)}
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
                        onClick={() => handleExpandCustomer(customer.id)}
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
                                  {fmtCurrency(customer.total_spent || 0)}
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
                          <p className="text-xs font-bold text-gray-600 mb-2">Historial de compras</p>
                          {historyLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="w-5 h-5 border-2 border-[#EF4444] border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : customerHistory.length > 0 ? (
                            <div>
                              {customerHistory[0]?.is_vip && (
                                <span className="inline-block mb-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⭐ VIP — {customerHistory[0]?.total_purchases} compras · {fmtCurrency(customerHistory[0]?.total_spent || 0)}</span>
                              )}
                              <div className="overflow-x-auto"><table className="data-table text-xs w-full">
                                <thead>
                                  <tr>
                                    <th>Orden</th>
                                    <th>Evento</th>
                                    <th className="hidden sm:table-cell">Zona</th>
                                    <th className="text-right">Cant</th>
                                    <th className="text-right">Total</th>
                                    <th>Estado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {customerHistory.map((h: CustomerHistory, idx: number) => (
                                    <tr key={idx}>
                                      <td className="font-mono text-[#EF4444] font-bold text-[11px]">{h.order_number}</td>
                                      <td className="truncate max-w-[120px]">{h.event_name}</td>
                                      <td className="hidden sm:table-cell">{h.zone_name}</td>
                                      <td className="text-right">{h.quantity}</td>
                                      <td className="text-right font-bold">{fmtCurrency(h.total_price || 0)}</td>
                                      <td>
                                        <div className="flex items-center gap-1">
                                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${h.payment_status === 'completed' ? 'bg-green-500' : h.payment_status === 'refunded' ? 'bg-red-500' : 'bg-yellow-500'}`}>
                                            {h.payment_status === 'completed' ? 'Pagado' : h.payment_status === 'refunded' ? 'Reemb.' : h.payment_status}
                                          </span>
                                          {/* ticket_used column dropped */}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table></div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 text-center py-2">Sin historial de compras</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Server-side pagination */}
              {customerTotal > customerPageSize && (
                <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
                  <span>
                    {((customerPage - 1) * customerPageSize) + 1}-{Math.min(customerPage * customerPageSize, customerTotal)} de {customerTotal.toLocaleString()} clientes
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCustomerSearch(customerPage - 1)}
                      disabled={customerPage <= 1}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 font-bold"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => handleCustomerSearch(customerPage + 1)}
                      disabled={customerPage * customerPageSize >= customerTotal}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 font-bold"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}

              {customerSearch && searchResults.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">No se encontraron clientes</p>
              )}

              {/* Recovery — inline below CRM */}
              {ticketRecovery.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <h3 className="text-sm font-extrabold text-[#1E293B] mb-2">Recuperación de Boletos ({ticketRecovery.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="data-table text-xs">
                      <thead><tr><th>Contacto</th><th>Evento</th><th className="hidden sm:table-cell">Notas</th><th>Fecha</th><th>Estado</th></tr></thead>
                      <tbody>
                        {ticketRecovery.map(tr => (
                          <tr key={tr.id}>
                            <td><span className="font-bold">{tr.email || tr.phone || '—'}</span>{tr.phone && tr.email && <span className="text-gray-400 hidden sm:inline"> · {tr.phone}</span>}</td>
                            <td className="font-bold">{tr.event_mentioned || '—'}</td>
                            <td className="hidden sm:table-cell text-gray-500 max-w-[200px] truncate">{tr.notes || '—'}</td>
                            <td className="whitespace-nowrap">{new Date(tr.created_at).toLocaleDateString('es-MX', {day:'numeric',month:'short'})}</td>
                            <td><span className={`badge ${tr.status === 'completed' ? 'badge-success' : tr.status === 'sent' ? 'badge-info' : 'badge-warning'}`}>{tr.status === 'completed' ? 'OK' : tr.status === 'sent' ? 'Enviado' : 'Pendiente'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gestión Tab = Cupones + Escalaciones */}
          {activeTab === 'gestion' && (
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

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Tipo</th>
                      <th>Descuento</th>
                      <th className="text-right">Usos</th>
                      <th className="text-right">Máximo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                {cupones.map(c => {
                  const usedCount = c.uses_count || 0
                  const discType = c.type || 'fixed'
                  // Some coupons have type='flat' but use discount_percent — handle gracefully
                  const hasPercent = c.discount_percent && c.discount_percent > 0
                  const hasAmount = c.discount_amount && c.discount_amount > 0
                  const discountVal = hasPercent ? c.discount_percent : hasAmount ? c.discount_amount : 0
                  const discLabel = hasPercent ? `${discountVal}%` : fmtCurrency(discountVal || 0)

                  return (
                    <tr key={c.id}>
                      <td className="font-mono font-bold">{c.code}</td>
                      <td>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700">
                          {hasPercent ? 'Porcentaje' : discType === 'bogo' ? 'BOGO' : 'Monto fijo'}
                        </span>
                      </td>
                      <td className="font-bold text-[#EF4444]">{discLabel}</td>
                      <td className="text-right">{usedCount}</td>
                      <td className="text-right">{c.max_uses || '∞'}</td>
                      <td>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold text-white ${c.is_active ? 'bg-green-500' : 'bg-gray-400'}`}>
                          {c.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {cupones.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8">No hay cupones disponibles</td></tr>
                )}
                  </tbody>
                </table>
              </div>

              {/* Escalaciones — inline below cupones */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <h3 className="text-sm font-extrabold text-[#1E293B] mb-2">Escalaciones ({escalations.length})</h3>
                {escalations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="data-table text-xs">
                      <thead><tr><th>Razón</th><th>Evento</th><th className="hidden sm:table-cell">Descripción</th><th>Fecha</th><th>Estado</th></tr></thead>
                      <tbody>
                        {escalations.map(esc => (
                          <tr key={esc.id}>
                            <td className="font-bold">{esc.reason || '—'}</td>
                            <td>{esc.event_mentioned || '—'}</td>
                            <td className="hidden sm:table-cell max-w-[200px] truncate">{esc.description || esc.situation || '—'}</td>
                            <td className="whitespace-nowrap">{new Date(esc.created_at).toLocaleDateString('es-MX', {day:'numeric',month:'short'})}</td>
                            <td><span className={`badge ${esc.resolved ? 'badge-success' : 'badge-error'}`}>{esc.resolved ? 'Resuelto' : 'Pendiente'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-4 text-gray-400 text-sm">✅ Sin escalaciones pendientes</p>
                )}
              </div>
            </div>
          )}

          {/* Blog / SEO Tab */}
          {activeTab === 'blog' && blogPosts.length > 0 && (
            <div className="space-y-3">
              <table className="data-table text-xs">
                <thead><tr><th>Título</th><th>Estado</th><th className="hidden sm:table-cell">Publicado</th><th>Link</th></tr></thead>
                <tbody>
                  {blogPosts.map(bp => (
                    <tr key={bp.id}>
                      <td className="font-bold max-w-[250px]">{bp.title}</td>
                      <td><span className={`badge ${(bp as any).published ? 'badge-success' : 'badge-warning'}`}>{(bp as any).published ? 'Publicado' : 'Borrador'}</span></td>
                      <td className="hidden sm:table-cell text-gray-400">{bp.published_at ? new Date(bp.published_at).toLocaleDateString('es-MX', {day:'numeric',month:'short'}) : '—'}</td>
                      <td>
                        {bp.slug ? (
                          <a href={`https://dulos.io/blog/${bp.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-[10px] font-medium">🔗 Ver</a>
                        ) : (
                          <span className="text-gray-300 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Dead tabs removed — fused into Escaneo, Clientes, Gestión, Blog */}
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

      {/* Blog moved to its own sub-tab above */}

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
                  className={"w-full px-3 py-2 border rounded-lg text-sm uppercase focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444] " + (couponErrors.code ? 'border-red-400' : 'border-gray-200')}
                />
                {couponErrors.code && <p className="text-xs text-red-500 mt-1">{couponErrors.code}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Tipo de descuento</label>
                <select
                  value={couponForm.type}
                  onChange={e => setCouponForm({ ...couponForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
                >
                  <option value="percentage">Porcentaje</option>
                  <option value="fixed">Monto fijo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">{couponForm.type === 'percentage' ? 'Porcentaje (%)' : 'Monto ($)'}</label>
                <input
                  type="number"
                  value={couponForm.type === 'percentage' ? couponForm.discount_percent : couponForm.discount_amount}
                  onChange={e => setCouponForm({ ...couponForm, [couponForm.type === 'percentage' ? 'discount_percent' : 'discount_amount']: e.target.value })}
                  placeholder={couponForm.type === 'percentage' ? '15' : '100'}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Evento asociado</label>
                <select
                  value={couponForm.event_id}
                  onChange={e => setCouponForm({ ...couponForm, event_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Fecha de expiración</label>
                <input
                  type="date"
                  value={couponForm.valid_until}
                  onChange={e => setCouponForm({ ...couponForm, valid_until: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]"
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
                disabled={!couponForm.code || (couponForm.type === 'percentage' ? !couponForm.discount_percent : !couponForm.discount_amount) || couponSubmitting}
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
                          {fmtCurrency(selectedCustomer.total_spent || 0)}
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
