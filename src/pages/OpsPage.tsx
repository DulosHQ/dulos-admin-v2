'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  fetchCheckins,
  fetchAllCoupons,
  Checkin,
  Coupon,
} from '../lib/supabase'

const ACCENT = '#E63946'
const tabs = ['Scanner', 'Historial', 'Cupones'] as const

interface CheckinDisplay {
  nombre: string
  ticket: string
  hora: string
  ok: boolean
}

interface HistorialDisplay {
  ticket: string
  cliente: string
  evento: string
  hora: string
  ok: boolean
}

interface CuponDisplay {
  id: string
  nombre: string
  descuento: string
  usado: number
  total: number
  activo: boolean
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between p-3 bg-[#f8f6f6] rounded-lg animate-pulse">
      <div>
        <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-24"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-16"></div>
    </div>
  )
}

export default function OpsPage() {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Scanner')
  const [loading, setLoading] = useState(true)
  const [checkIns, setCheckIns] = useState<CheckinDisplay[]>([])
  const [historial, setHistorial] = useState<HistorialDisplay[]>([])
  const [cupones, setCupones] = useState<CuponDisplay[]>([])
  const [eventosUnicos, setEventosUnicos] = useState<string[]>([])
  const [filtroEvento, setFiltroEvento] = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [checkInCount, setCheckInCount] = useState(0)
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [checkinsData, couponsData] = await Promise.all([
          fetchCheckins(),
          fetchAllCoupons(),
        ])

        // Map checkins to display format — filter out DUPLICADO/null
        const checkInsDisplay: CheckinDisplay[] = checkinsData
          .filter((c) => c.customer_name && c.customer_name !== 'DUPLICADO')
          .slice(0, 5)
          .map((c) => ({
            nombre: c.customer_name,
            ticket: c.ticket_number,
            hora: formatTime(c.scanned_at),
            ok: c.status === 'success' || c.status === 'valid',
          }))
        setCheckIns(checkInsDisplay)

        // Map checkins to historial format — show 'Check-in duplicado' for DUPLICADO, filter null
        const historialDisplay: HistorialDisplay[] = checkinsData
          .filter((c) => c.customer_name != null)
          .map((c) => ({
            ticket: c.ticket_number,
            cliente: c.customer_name === 'DUPLICADO' ? 'Check-in duplicado' : c.customer_name,
            evento: c.event_name,
            hora: formatTime(c.scanned_at),
            ok: c.status === 'success' || c.status === 'valid',
          }))
        setHistorial(historialDisplay)

        // Get unique events
        const eventos = [...new Set(checkinsData.map((c) => c.event_name))]
        setEventosUnicos(eventos)

        // Set checkin count
        setCheckInCount(checkinsData.length)

        // Map coupons to display format
        const cuponesDisplay: CuponDisplay[] = couponsData.map((c) => ({
          id: c.id,
          nombre: c.code,
          descuento: c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`,
          usado: c.used_count,
          total: c.max_uses || 999,
          activo: c.is_active,
        }))
        setCupones(cuponesDisplay)

        setLoading(false)
      } catch (error) {
        console.error('Error loading ops data:', error)
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta acceso a la camara')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
    } catch (err) {
      const error = err as Error
      let errorMsg: string
      if (error.name === 'NotAllowedError') {
        errorMsg = 'Permiso de camara denegado. Por favor habilita el acceso en tu navegador.'
      } else if (error.name === 'NotFoundError') {
        errorMsg = 'No se encontro ninguna camara en este dispositivo.'
      } else {
        errorMsg = 'No se pudo acceder a la camara: ' + error.message
      }
      alert(errorMsg)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'Scanner') {
      stopCamera()
    }
  }, [activeTab, stopCamera])

  const historialFiltrado = historial.filter(h => {
    const matchEvento = !filtroEvento || h.evento === filtroEvento
    const matchCliente = !busquedaCliente || h.cliente.toLowerCase().includes(busquedaCliente.toLowerCase())
    return matchEvento && matchCliente
  })

  const toggleCupon = (id: string) => {
    setCupones(cupones.map(c => c.id === id ? { ...c, activo: !c.activo } : c))
  }

  // Calculate stats for reports
  const checkInsByEvent = historial.reduce((acc, h) => {
    acc[h.evento] = (acc[h.evento] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalCheckins = historial.length
  const eventStats = Object.entries(checkInsByEvent)
    .map(([name, count]) => ({ n: name.split(' ')[0], p: Math.round((count / totalCheckins) * 100) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 4)

  if (loading) {
    return (
      <div className="bg-[#f8f6f6] p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Operaciones</h1>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#f8f6f6] p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Operaciones</h1>

        <div className="border-b border-gray-200 mb-4">
          <nav className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-[3px] cursor-pointer ${
                  activeTab === tab
                    ? 'text-[#E63946] border-[#E63946]'
                    : 'text-gray-500 border-transparent hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'Scanner' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white shadow-sm text-sm font-medium text-gray-700">Check-ins hoy: {checkInCount}</span>
              <span className="px-3 py-1 rounded-full bg-green-50 text-sm font-medium text-green-700">Exitosos: {historial.filter(h => h.ok).length}</span>
              <span className="px-3 py-1 rounded-full bg-red-50 text-sm font-medium text-red-700">Fallidos: {historial.filter(h => !h.ok).length}</span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-sm font-medium text-gray-600">{Math.round((checkInCount / 1200) * 100)}% capacidad</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">📷</span>
                {cameraActive ? (
                  <div className="flex-1 flex items-center gap-3">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-48 h-28 rounded-lg bg-black object-cover"
                    />
                    <button
                      onClick={stopCamera}
                      className="px-3 py-1.5 bg-[#E63946] text-white rounded-lg text-sm font-medium hover:bg-[#c5303c] transition-colors cursor-pointer"
                    >
                      Detener
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Escanear codigo QR o ingresar ticket..."
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E63946]"
                    />
                    <button
                      onClick={startCamera}
                      className="px-3 py-1.5 bg-[#E63946] text-white rounded-lg text-sm font-medium hover:bg-[#c5303c] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Escanear QR
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Check-ins Recientes</h3>
              <div className="space-y-2">
                {checkIns.length > 0 ? checkIns.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-[#f8f6f6] rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.nombre}</p>
                      <p className="text-xs text-gray-500">{c.ticket}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{c.hora}</span>
                      <span className={c.ok ? 'text-green-500' : 'text-red-500'}>
                        {c.ok ? '\u2713' : '\u2717'}
                      </span>
                    </div>
                  </div>
                )) : (
                  <p className="text-gray-500 text-center py-4 text-sm">No hay check-ins recientes</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Historial' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-4">
                <select
                  value={filtroEvento}
                  onChange={e => setFiltroEvento(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E63946]"
                >
                  <option value="">Todos los eventos</option>
                  {eventosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={busquedaCliente}
                  onChange={e => setBusquedaCliente(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E63946]"
                />
              </div>
              <table className="w-full">
                <thead className="bg-[#f8f6f6]">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Ticket</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Cliente</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Evento</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Hora</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historialFiltrado.length > 0 ? historialFiltrado.map((h, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-[#f8f6f6]">
                      <td className="py-3 px-4 text-sm font-mono text-gray-900">{h.ticket}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{h.cliente}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{h.evento}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">{h.hora}</td>
                      <td className="py-3 px-4">
                        <span className={h.ok ? 'text-green-500 text-lg' : 'text-red-500 text-lg'}>
                          {h.ok ? '\u2713' : '\u2717'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No hay registros de check-in
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-bold">Reportes de Acceso</h3>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="font-semibold text-gray-900 text-sm mb-3">Check-ins por Evento</h4>
                {eventStats.length > 0 ? eventStats.map(d => (
                  <div key={d.n} className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-600 w-16 truncate">{d.n}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded"><div className="h-full rounded" style={{ width: `${d.p}%`, backgroundColor: '#E63946' }} /></div>
                    <span className="text-xs text-gray-600 w-8">{d.p}%</span>
                  </div>
                )) : (
                  <p className="text-gray-500 text-sm">No hay datos disponibles</p>
                )}
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="font-semibold text-gray-900 text-sm mb-3">Resumen</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total check-ins</span>
                    <span className="font-bold">{totalCheckins}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Exitosos</span>
                    <span className="font-bold text-green-600">{historial.filter(h => h.ok).length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fallidos</span>
                    <span className="font-bold text-red-600">{historial.filter(h => !h.ok).length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Cupones' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Cupones</h3>
              <button
                onClick={() => alert('Crear nuevo cupon')}
                className="px-4 py-2 text-white rounded-lg"
                style={{ backgroundColor: ACCENT }}
              >
                + Crear
              </button>
            </div>
            <div className="space-y-4">
              {cupones.length > 0 ? cupones.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-gray-900">{c.nombre}</span>
                      <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">{c.descuento}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-gray-500">{c.usado}/{c.total}</span>
                      <div className="w-40 h-2 bg-gray-200 rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(c.usado / c.total) * 100}%`, backgroundColor: ACCENT }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleCupon(c.id)}
                      className={`w-12 h-6 rounded-full transition-colors ${c.activo ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${c.activo ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                    <button
                      onClick={() => alert('Editar cupon')}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              )) : (
                <p className="text-gray-500 text-center py-8">No hay cupones configurados</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
