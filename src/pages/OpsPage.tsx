'use client'

import { useState, useEffect } from 'react'

const ACCENT = '#E63946'
const tabs = ['Scanner', 'Historial', 'Cupones'] as const

const checkIns = [
  { nombre: 'María García', ticket: 'TKT-001234', hora: '19:45', ok: true },
  { nombre: 'Carlos López', ticket: 'TKT-001235', hora: '19:43', ok: true },
  { nombre: 'Ana Martínez', ticket: 'TKT-001236', hora: '19:41', ok: false },
  { nombre: 'Roberto Sánchez', ticket: 'TKT-001237', hora: '19:38', ok: true },
  { nombre: 'Laura Hernández', ticket: 'TKT-001238', hora: '19:35', ok: true },
]

const historial = [
  { ticket: 'TKT-001234', cliente: 'María García', evento: 'Concierto Bad Bunny', hora: '19:45', ok: true },
  { ticket: 'TKT-001235', cliente: 'Carlos López', evento: 'Concierto Bad Bunny', hora: '19:43', ok: true },
  { ticket: 'TKT-001236', cliente: 'Ana Martínez', evento: 'Festival Corona', hora: '19:41', ok: false },
  { ticket: 'TKT-001237', cliente: 'Roberto Sánchez', evento: 'Luis Miguel Tour', hora: '19:38', ok: true },
  { ticket: 'TKT-001238', cliente: 'Laura Hernández', evento: 'Coldplay World Tour', hora: '19:35', ok: false },
  { ticket: 'TKT-001239', cliente: 'Pedro Ramírez', evento: 'Concierto Bad Bunny', hora: '19:30', ok: true },
  { ticket: 'TKT-001240', cliente: 'Sofia Torres', evento: 'Festival Corona', hora: '19:28', ok: true },
  { ticket: 'TKT-001241', cliente: 'Miguel Flores', evento: 'Luis Miguel Tour', hora: '19:25', ok: true },
]

const cuponesInit = [
  { id: 1, nombre: 'VERANO2026', descuento: '15%', usado: 45, total: 100, activo: true },
  { id: 2, nombre: 'PRIMERACOMPRA', descuento: '20%', usado: 234, total: 500, activo: true },
  { id: 3, nombre: 'FIJO50', descuento: '$50', usado: 89, total: 200, activo: true },
  { id: 4, nombre: 'BLACKFRIDAY', descuento: '30%', usado: 100, total: 100, activo: false },
]

const eventosUnicos = [...new Set(historial.map(h => h.evento))]

export default function OpsPage() {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Scanner')
  const [cupones, setCupones] = useState(cuponesInit)
  const [filtroEvento, setFiltroEvento] = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [checkInCount, setCheckInCount] = useState(234)

  useEffect(() => {
    if (activeTab !== 'Scanner') return
    const interval = setInterval(() => setCheckInCount(c => Math.min(c + 1, 1200)), 5000)
    return () => clearInterval(interval)
  }, [activeTab])

  const historialFiltrado = historial.filter(h => {
    const matchEvento = !filtroEvento || h.evento === filtroEvento
    const matchCliente = !busquedaCliente || h.cliente.toLowerCase().includes(busquedaCliente.toLowerCase())
    return matchEvento && matchCliente
  })

  const toggleCupon = (id: number) => {
    setCupones(cupones.map(c => c.id === id ? { ...c, activo: !c.activo } : c))
  }

  return (
    <div className="min-h-screen bg-[#f8f6f6] p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Operaciones</h1>

        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-8">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium ${
                  activeTab === tab
                    ? 'border-b-2 border-[#E63946] text-[#E63946]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'Scanner' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Check-ins hoy: {checkInCount} / 1,200 ({Math.round((checkInCount / 1200) * 100)}%)</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#E63946] rounded-full transition-all" style={{ width: `${(checkInCount / 1200) * 100}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 rounded-xl aspect-video flex flex-col items-center justify-center gap-4 p-6">
              <span className="text-6xl">📷</span>
              <p className="text-white text-lg">QR Scanner</p>
              <p className="text-gray-400 text-sm text-center">Apunta al código QR del boleto</p>
              <button
                onClick={() => {
                  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    navigator.mediaDevices.getUserMedia({ video: true })
                      .then(() => alert('Cámara activada'))
                      .catch(() => alert('No se pudo acceder a la cámara'));
                  } else {
                    alert('Tu navegador no soporta acceso a la cámara');
                  }
                }}
                className="px-4 py-2 bg-[#E63946] text-white rounded-lg font-medium hover:bg-[#c5303c] transition-colors"
              >
                Activar Cámara
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Check-ins Recientes</h3>
              <div className="space-y-3">
                {checkIns.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[#f8f6f6] rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{c.nombre}</p>
                      <p className="text-sm text-gray-500">{c.ticket}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">{c.hora}</span>
                      <span className={c.ok ? 'text-green-500 text-xl' : 'text-red-500 text-xl'}>
                        {c.ok ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'Historial' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex gap-4">
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
                {historialFiltrado.map((h, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-[#f8f6f6]">
                    <td className="py-3 px-4 text-sm font-mono text-gray-900">{h.ticket}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{h.cliente}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{h.evento}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{h.hora}</td>
                    <td className="py-3 px-4">
                      <span className={h.ok ? 'text-green-500 text-lg' : 'text-red-500 text-lg'}>
                        {h.ok ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Cupones' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Cupones</h3>
              <button
                onClick={() => alert('Crear nuevo cupón')}
                className="px-4 py-2 text-white rounded-lg"
                style={{ backgroundColor: ACCENT }}
              >
                + Crear
              </button>
            </div>
            <div className="space-y-4">
              {cupones.map(c => (
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
                      onClick={() => alert('Editar cupón')}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
