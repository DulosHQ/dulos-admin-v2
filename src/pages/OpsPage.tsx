'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  fetchCheckins, 
  fetchAllCoupons, 
  fetchTickets, 
  searchCustomerByNameOrEmail, 
  fetchNotificationLogs,
  Checkin, 
  Coupon, 
  Ticket, 
  Customer, 
  AuditLog 
} from '../lib/supabase'

const ACCENT = '#E63946'

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export default function OpsPage() {
  const [loading, setLoading] = useState(true)
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [cupones, setCupones] = useState<Coupon[]>([])
  const [notificationLogs, setNotificationLogs] = useState<AuditLog[]>([])
  const [filtroEvento, setFiltroEvento] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [scanResult, setScanResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [manualTicket, setManualTicket] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    Promise.all([
      fetchCheckins().catch(() => []),
      fetchAllCoupons().catch(() => []),
      fetchTickets().catch(() => []),
      fetchNotificationLogs().catch(() => []),
    ]).then(([ci, co, tk, nl]) => {
      setCheckins(ci.filter((c: Checkin) => c.customer_name && c.customer_name !== 'DUPLICADO'))
      setCupones(co)
      setTickets(tk)
      setNotificationLogs(nl)
      setLoading(false)
    })
  }, [])

  // Customer search function
  const handleCustomerSearch = async () => {
    if (!customerSearch.trim()) return
    try {
      const results = await searchCustomerByNameOrEmail(customerSearch.trim())
      setSearchResults(results)
    } catch (error) {
      console.error('Error searching customers:', error)
    }
  }

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      setCameraActive(true)
      setScanResult(null)
    } catch { alert('No se pudo acceder a la cámara') }
  }, [])

  const handleManualScan = () => {
    if (!manualTicket.trim()) return
    const ticket = tickets.find(t => t.ticket_number === manualTicket.trim() || t.ticket_token === manualTicket.trim())
    if (ticket) {
      if (ticket.status === 'used') {
        setScanResult({ ok: false, msg: `⚠️ Boleto ya usado — ${ticket.customer_name}` })
      } else {
        setScanResult({ ok: true, msg: `✅ Válido — ${ticket.customer_name} · ${ticket.zone_name}` })
      }
    } else {
      setScanResult({ ok: false, msg: '❌ Boleto no encontrado' })
    }
    setManualTicket('')
    setTimeout(() => setScanResult(null), 5000)
  }

  const eventosUnicos = [...new Set(checkins.map(c => c.event_name))]
  const historialFiltrado = checkins.filter(c => {
    if (filtroEvento && c.event_name !== filtroEvento) return false
    if (busqueda && !c.customer_name.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const totalOk = checkins.filter(c => c.status === 'success' || c.status === 'valid').length
  const totalFail = checkins.length - totalOk
  const avgPerHour = checkins.length > 0 ? Math.round(checkins.length / Math.max(1, new Set(checkins.map(c => new Date(c.scanned_at).getHours())).size)) : 0

  // Stats by event
  const byEvent = checkins.reduce((a, c) => { a[c.event_name] = (a[c.event_name] || 0) + 1; return a }, {} as Record<string, number>)
  const eventStats = Object.entries(byEvent).map(([n, c]) => ({ name: n, count: c, pct: Math.round((c / checkins.length) * 100) })).sort((a, b) => b.count - a.count).slice(0, 5)

  // Ticket stats
  const ticketsByStatus = tickets.reduce((a, t) => { a[t.status] = (a[t.status] || 0) + 1; return a }, {} as Record<string, number>)

  if (loading) return <div className="p-4"><div className="h-40 bg-gray-100 rounded-lg animate-pulse" /></div>

  return (
    <div className="space-y-3">
      {/* Scanner Section — Hero */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 text-white">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Scanner */}
          <div className="lg:col-span-1">
            <h2 className="text-sm font-bold mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              ESCÁNER ACTIVO
            </h2>
            {cameraActive ? (
              <div className="relative">
                <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-[4/3] rounded-lg bg-black object-cover" />
                <div className="absolute inset-0 border-2 border-[#E63946] rounded-lg pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/40 rounded-lg" />
                </div>
                <button onClick={stopCamera} className="absolute bottom-2 right-2 px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-medium">Detener</button>
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
                    className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#E63946]"
                  />
                  <button onClick={handleManualScan} className="px-3 py-2 bg-[#E63946] rounded-lg text-xs font-bold">Validar</button>
                </div>
                <button onClick={startCamera} className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  📷 Abrir Cámara QR
                </button>
              </div>
            )}
            {scanResult && (
              <div className={`mt-2 p-2 rounded-lg text-sm font-medium ${scanResult.ok ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {scanResult.msg}
              </div>
            )}
          </div>

          {/* Right: Live stats */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/50 text-[10px] uppercase font-semibold">Check-ins</p>
              <p className="text-2xl font-bold">{checkins.length}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/50 text-[10px] uppercase font-semibold">Exitosos</p>
              <p className="text-2xl font-bold text-green-400">{totalOk}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/50 text-[10px] uppercase font-semibold">Fallidos</p>
              <p className="text-2xl font-bold text-red-400">{totalFail}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/50 text-[10px] uppercase font-semibold">Prom/Hora</p>
              <p className="text-2xl font-bold">{avgPerHour}</p>
            </div>

            {/* Ticket inventory */}
            <div className="col-span-2 sm:col-span-4 bg-white/5 rounded-lg p-3">
              <p className="text-white/50 text-[10px] uppercase font-semibold mb-2">Inventario de Boletos</p>
              <div className="flex gap-3 text-xs">
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
            <div className="col-span-2 sm:col-span-4 bg-white/5 rounded-lg p-3">
              <p className="text-white/50 text-[10px] uppercase font-semibold mb-2">Check-ins por Evento</p>
              <div className="space-y-1.5">
                {eventStats.map(e => (
                  <div key={e.name} className="flex items-center gap-2">
                    <span className="text-xs w-24 truncate text-white/70">{e.name}</span>
                    <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#E63946]" style={{ width: `${e.pct}%` }} />
                    </div>
                    <span className="text-xs text-white/50 w-14 text-right">{e.count} ({e.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Lookup Section */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100">
          <h3 className="text-sm font-extrabold">Búsqueda de Clientes</h3>
        </div>
        <div className="p-3">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustomerSearch()}
              placeholder="Buscar por nombre o email..."
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946]"
            />
            <button 
              onClick={handleCustomerSearch}
              className="px-3 py-1.5 bg-[#E63946] text-white rounded text-sm font-bold hover:bg-[#c5303c]"
            >
              Buscar
            </button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {searchResults.map(customer => (
                <div 
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className="p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-extrabold text-sm">{customer.name}</p>
                      <p className="text-xs text-gray-500">{customer.email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {customer.total_orders} orden{customer.total_orders !== 1 ? 'es' : ''} • 
                        Cliente desde {new Date(customer.created_at).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                    <button className="text-xs text-[#E63946] font-bold hover:underline">Ver Historial</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {customerSearch && searchResults.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-4">No se encontraron clientes</p>
          )}
        </div>
      </div>

      {/* Historial + Cupones + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Historial */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold">Historial de Check-ins</h3>
            <div className="flex gap-2">
              <select value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-xs">
                <option value="">Todos</option>
                {eventosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-xs w-28" />
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-600">Ticket</th>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-600">Evento</th>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-600">Hora</th>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {historialFiltrado.map((c, i) => (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 px-3 font-mono text-[#E63946]">{c.ticket_number}</td>
                    <td className="py-1.5 px-3">{c.customer_name}</td>
                    <td className="py-1.5 px-3 text-gray-600">{c.event_name}</td>
                    <td className="py-1.5 px-3 text-gray-500">{formatTime(c.scanned_at)}</td>
                    <td className="py-1.5 px-3">
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
        </div>

        {/* Notification Log */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold">Log de Notificaciones</h3>
            <button className="px-2 py-1 text-white rounded text-xs font-bold" style={{ backgroundColor: ACCENT }}>Filtros</button>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {notificationLogs.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {notificationLogs.map(log => (
                  <div key={log.id} className="px-3 py-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-900">{log.action}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{log.user_email}</p>
                        <p className="text-xs text-gray-400">{formatTime(log.created_at)}</p>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1"></span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{log.details}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-gray-400 text-xs">Sin notificaciones</div>
            )}
          </div>
        </div>

        {/* Cupones */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold">Cupones</h3>
            <button className="px-2 py-1 text-white rounded text-xs font-bold" style={{ backgroundColor: ACCENT }}>+ Crear</button>
          </div>
          <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
            {cupones.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-extrabold text-xs">{c.code}</span>
                    <span className="px-1 py-0.5 text-[10px] rounded bg-gray-100 font-bold">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-16 h-1 bg-gray-200 rounded-full"><div className="h-full rounded-full" style={{ width: `${c.max_uses ? (c.used_count / c.max_uses) * 100 : 0}%`, backgroundColor: ACCENT }} /></div>
                    <span className="text-[10px] text-gray-400">{c.used_count}/{c.max_uses || '∞'}</span>
                  </div>
                </div>
                <span className={`w-2 h-2 rounded-full ${c.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
            ))}
            {cupones.length === 0 && <div className="py-6 text-center text-gray-400 text-xs">Sin cupones</div>}
          </div>
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-extrabold text-gray-900">Historial de Cliente</h3>
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-extrabold text-lg text-gray-900">{selectedCustomer.name}</p>
                <p className="text-sm text-gray-600">{selectedCustomer.email}</p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-gray-500">
                    <span className="font-bold">{selectedCustomer.total_orders}</span> órdenes
                  </span>
                  <span className="text-gray-500">
                    Cliente desde <span className="font-bold">{new Date(selectedCustomer.created_at).toLocaleDateString('es-MX')}</span>
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                <h4 className="font-extrabold text-sm text-gray-900">Historial de Compras</h4>
                {(selectedCustomer as any).tickets?.length > 0 ? (
                  (selectedCustomer as any).tickets.map((ticket: any, index: number) => (
                    <div key={index} className="p-2 border border-gray-200 rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-[#E63946]">{ticket.ticket_number}</p>
                          <p className="text-xs text-gray-600">{ticket.zone_name}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(ticket.created_at).toLocaleDateString('es-MX')}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold text-white ${
                          ticket.status === 'valid' ? 'bg-green-500' :
                          ticket.status === 'used' ? 'bg-blue-500' : 'bg-yellow-500'
                        }`}>
                          {ticket.status === 'valid' ? 'Válido' : 
                           ticket.status === 'used' ? 'Usado' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 text-sm py-4">Sin historial de compras</p>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <button 
                  onClick={() => alert('Enviar email al cliente')}
                  className="px-4 py-2 bg-[#E63946] text-white rounded-lg text-sm font-bold hover:bg-[#c5303c]"
                >
                  Enviar Email
                </button>
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-bold"
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
