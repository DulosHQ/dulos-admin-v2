'use client';

import { useState } from 'react';

const ACCENT = '#E63946';

const tabs = ['Equipo', 'Roles', 'Sistema', 'Auditoría'] as const;
type Tab = typeof tabs[number];

const usuarios = [
  { id: 1, nombre: 'Ana García', email: 'ana@dulos.com', rol: 'ADMIN', activo: true, ultimoAcceso: Date.now() - 2 * 60 * 60 * 1000 },
  { id: 2, nombre: 'Carlos López', email: 'carlos@dulos.com', rol: 'OPERADOR', activo: true, ultimoAcceso: Date.now() - 24 * 60 * 60 * 1000 },
  { id: 3, nombre: 'María Torres', email: 'maria@dulos.com', rol: 'TAQUILLERO', activo: true, ultimoAcceso: Date.now() - 3 * 24 * 60 * 60 * 1000 },
  { id: 4, nombre: 'Pedro Ruiz', email: 'pedro@dulos.com', rol: 'OPERADOR', activo: false, ultimoAcceso: Date.now() - 30 * 24 * 60 * 60 * 1000 },
  { id: 5, nombre: 'Laura Díaz', email: 'laura@dulos.com', rol: 'TAQUILLERO', activo: true, ultimoAcceso: Date.now() - 5 * 60 * 1000 },
];

const permisosDetalle: Record<string, Record<string, string[]>> = {
  ADMIN: { Sistema: ['config', 'usuarios', 'roles', 'logs'], Finanzas: ['reportes', 'comisiones', 'pagos', 'reembolsos'], Eventos: ['crear', 'editar', 'eliminar', 'publicar'], Ventas: ['ver', 'cancelar', 'cortesía'] },
  OPERADOR: { Eventos: ['crear', 'editar', 'publicar'], Finanzas: ['reportes', 'pagos'], Ventas: ['ver', 'cancelar'] },
  TAQUILLERO: { Ventas: ['ver', 'vender'], Eventos: ['ver'] },
};
const roles = [
  { nombre: 'ADMIN', permisos: 24 },
  { nombre: 'OPERADOR', permisos: 12 },
  { nombre: 'TAQUILLERO', permisos: 6 },
];

const configs = [
  { titulo: 'Comisión', valor: '3.5%', desc: 'Por transacción' },
  { titulo: 'Fee de Servicio', valor: '$2.50', desc: 'Cargo fijo' },
  { titulo: 'Zona Horaria', valor: 'America/Mexico_City', desc: 'UTC-6' },
  { titulo: 'Moneda', valor: 'MXN', desc: 'Peso Mexicano' },
];

const logs = [
  { timestamp: '2024-01-15 14:32:01', usuario: 'ana@dulos.com', accion: 'Creó usuario carlos@dulos.com' },
  { timestamp: '2024-01-15 13:21:45', usuario: 'ana@dulos.com', accion: 'Modificó comisión a 3.5%' },
  { timestamp: '2024-01-15 11:05:22', usuario: 'carlos@dulos.com', accion: 'Desactivó usuario pedro@dulos.com' },
  { timestamp: '2024-01-14 18:44:10', usuario: 'ana@dulos.com', accion: 'Cambió zona horaria' },
  { timestamp: '2024-01-14 16:30:55', usuario: 'ana@dulos.com', accion: 'Actualizó permisos OPERADOR' },
  { timestamp: '2024-01-14 10:12:33', usuario: 'carlos@dulos.com', accion: 'Invitó a maria@dulos.com' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Equipo');

  return (
    <div className="min-h-screen bg-[#f8f6f6] p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Administración</h1>

      <div className="flex gap-6 border-b mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === tab ? 'border-b-2' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={activeTab === tab ? { borderColor: ACCENT, color: ACCENT } : {}}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Equipo' && <EquipoTab />}
      {activeTab === 'Roles' && <RolesTab />}
      {activeTab === 'Sistema' && <SistemaTab />}
      {activeTab === 'Auditoría' && <AuditoriaTab />}
    </div>
  );
}

const formatRelativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000), hrs = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (days > 0) return `hace ${days}d`;
  if (hrs > 0) return `hace ${hrs}h`;
  return `hace ${mins}m`;
};

function EquipoTab() {
  const permisosCount: Record<string, number> = { ADMIN: 24, OPERADOR: 12, TAQUILLERO: 6 };
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => alert('Invitar nuevo usuario')} className="px-4 py-2 rounded-lg text-white font-medium" style={{ backgroundColor: ACCENT }}>+ Invitar</button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-gray-600 border-b">
            <th className="pb-3">Nombre</th><th className="pb-3">Email</th><th className="pb-3">Rol</th><th className="pb-3">Último acceso</th><th className="pb-3">Estado</th><th className="pb-3"></th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="py-3 font-medium">{u.nombre}</td>
              <td className="py-3 text-gray-600">{u.email}</td>
              <td className="py-3">
                <span className="px-2 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: ACCENT }}>{u.rol}</span>
                <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-200 text-xs text-gray-600">{permisosCount[u.rol]}</span>
              </td>
              <td className="py-3 text-gray-500 text-sm">{formatRelativeTime(u.ultimoAcceso)}</td>
              <td className="py-3"><span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${u.activo ? 'bg-green-500' : 'bg-gray-400'}`} />{u.activo ? 'Activo' : 'Inactivo'}</span></td>
              <td className="py-3"><button onClick={() => alert('Editar usuario')} className="text-gray-500 hover:text-gray-700">Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RolesTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-1 gap-4">
      {roles.map((rol) => (
        <div key={rol.nombre} className="bg-white rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setExpanded(expanded === rol.nombre ? null : rol.nombre)}>
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg" style={{ color: ACCENT }}>{rol.nombre}</h3>
            <span className="text-gray-500">{expanded === rol.nombre ? '▲' : '▼'}</span>
          </div>
          <p className="text-gray-600">{rol.permisos} permisos asignados</p>
          {expanded === rol.nombre && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(permisosDetalle[rol.nombre] || {}).map(([cat, perms]) => (
                <div key={cat} className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-sm mb-1" style={{ color: ACCENT }}>{cat}</p>
                  {perms.map((p) => <span key={p} className="block text-xs text-gray-600">{p}</span>)}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SistemaTab() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4">
      {configs.map((c) => (
        <div key={c.titulo} className="border rounded-lg p-5">
          <p className="text-gray-500 text-sm mb-1">{c.titulo}</p>
          <p className="text-xl font-bold" style={{ color: ACCENT }}>
            {c.valor}
          </p>
          <p className="text-gray-400 text-sm">{c.desc}</p>
        </div>
      ))}
    </div>
  );
}

function AuditoriaTab() {
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const usuariosUnicos = [...new Set(logs.map((l) => l.usuario))];
  const acciones = ['Creó', 'Modificó', 'Desactivó', 'Cambió', 'Actualizó', 'Invitó'];
  const filtered = logs.filter((l) => {
    if (filtroUsuario && l.usuario !== filtroUsuario) return false;
    if (filtroAccion && !l.accion.startsWith(filtroAccion)) return false;
    if (fechaDesde && l.timestamp < fechaDesde) return false;
    if (fechaHasta && l.timestamp > fechaHasta + ' 23:59:59') return false;
    return true;
  });
  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los usuarios</option>
          {usuariosUnicos.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filtroAccion} onChange={(e) => setFiltroAccion(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todas las acciones</option>
          {acciones.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
      </div>
      <table className="w-full bg-white rounded-xl">
        <thead><tr className="text-left text-gray-600 border-b"><th className="pb-3 px-4 pt-4">Timestamp</th><th className="pb-3">Usuario</th><th className="pb-3">Acción</th></tr></thead>
        <tbody>
          {filtered.map((log, i) => (
            <tr key={i} className="border-b"><td className="py-3 px-4 text-gray-500 font-mono text-sm">{log.timestamp}</td><td className="py-3">{log.usuario}</td><td className="py-3">{log.accion}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
