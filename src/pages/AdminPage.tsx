'use client';

import { useState, useEffect } from 'react';
import {
  fetchTeam,
  fetchAuditLogs,
  TeamMember,
  AuditLog,
} from '../lib/supabase';

const ACCENT = '#E63946';

const tabs = ['Equipo', 'Roles', 'Sistema', 'Auditoria'] as const;
type Tab = typeof tabs[number];

interface TeamDisplay {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  ultimoAcceso: number;
  permisosCount: number;
}

interface LogDisplay {
  timestamp: string;
  usuario: string;
  accion: string;
}

const permisosDetalle: Record<string, Record<string, string[]>> = {
  ADMIN: { Sistema: ['config', 'usuarios', 'roles', 'logs'], Finanzas: ['reportes', 'comisiones', 'pagos', 'reembolsos'], Eventos: ['crear', 'editar', 'eliminar', 'publicar'], Ventas: ['ver', 'cancelar', 'cortesia'] },
  OPERADOR: { Eventos: ['crear', 'editar', 'publicar'], Finanzas: ['reportes', 'pagos'], Ventas: ['ver', 'cancelar'] },
  PRODUCTOR: { Eventos: ['ver', 'editar'], Finanzas: ['reportes'], Ventas: ['ver'] },
  TAQUILLERO: { Ventas: ['ver', 'vender'], Eventos: ['ver'] },
  SOPORTE: { Ventas: ['ver'], Eventos: ['ver'] },
};

const permisosCount: Record<string, number> = {
  ADMIN: 24,
  OPERADOR: 12,
  PRODUCTOR: 8,
  TAQUILLERO: 6,
  SOPORTE: 4,
};

const configs = [
  { titulo: 'Comision', valor: '3.5%', desc: 'Por transaccion' },
  { titulo: 'Fee de Servicio', valor: '$2.50', desc: 'Cargo fijo' },
  { titulo: 'Zona Horaria', valor: 'America/Mexico_City', desc: 'UTC-6' },
  { titulo: 'Moneda', valor: 'MXN', desc: 'Peso Mexicano' },
];

function SkeletonRow() {
  return (
    <tr className="border-b animate-pulse">
      <td className="py-3"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
      <td className="py-3"><div className="h-4 bg-gray-200 rounded w-40"></div></td>
      <td className="py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
      <td className="py-3"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
      <td className="py-3"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
    </tr>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Equipo');
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<TeamDisplay[]>([]);
  const [logs, setLogs] = useState<LogDisplay[]>([]);
  const [roles, setRoles] = useState<{ nombre: string; permisos: number }[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [teamData, auditData] = await Promise.all([
          fetchTeam().catch(() => []),
          fetchAuditLogs().catch(() => []),
        ]);

        // Map team members to display format
        const usuariosDisplay: TeamDisplay[] = teamData.map((t) => ({
          id: t.id,
          nombre: t.name,
          email: t.email,
          rol: t.role,
          activo: t.is_active,
          ultimoAcceso: t.last_login ? new Date(t.last_login).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000,
          permisosCount: t.permissions_count || permisosCount[t.role] || 0,
        }));
        setUsuarios(usuariosDisplay);

        // Build roles from unique team roles
        const roleSet = new Set(teamData.map((t) => t.role));
        const rolesDisplay = Array.from(roleSet).map((r) => ({
          nombre: r,
          permisos: permisosCount[r] || 0,
        }));
        setRoles(rolesDisplay);

        // Map audit logs to display format
        const logsDisplay: LogDisplay[] = auditData.map((l) => ({
          timestamp: new Date(l.created_at).toLocaleString('es-MX'),
          usuario: l.user_email,
          accion: `${l.action} ${l.entity_type}${l.entity_id ? ` (${l.entity_id})` : ''}`,
        }));
        setLogs(logsDisplay);

        setLoading(false);
      } catch (error) {
        console.error('Error loading admin data:', error);
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f6f6] p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Administracion</h1>

      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
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
        </div>
      </div>

      {activeTab === 'Equipo' && <EquipoTab loading={loading} usuarios={usuarios} />}
      {activeTab === 'Roles' && <RolesTab roles={roles} />}
      {activeTab === 'Sistema' && <SistemaTab />}
      {activeTab === 'Auditoria' && <AuditoriaTab loading={loading} logs={logs} />}
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

function EquipoTab({ loading, usuarios }: { loading: boolean; usuarios: TeamDisplay[] }) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => alert('Invitar nuevo usuario')} className="px-4 py-2 rounded-lg text-white font-medium" style={{ backgroundColor: ACCENT }}>+ Invitar</button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-gray-600 border-b">
            <th className="pb-3">Nombre</th><th className="pb-3">Email</th><th className="pb-3">Rol</th><th className="pb-3">Ultimo acceso</th><th className="pb-3">Estado</th><th className="pb-3"></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            [1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)
          ) : usuarios.length > 0 ? (
            usuarios.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="py-3 font-medium">{u.nombre}</td>
                <td className="py-3 text-gray-600">{u.email}</td>
                <td className="py-3">
                  <span className="px-2 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: ACCENT }}>{u.rol}</span>
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-200 text-xs text-gray-600">{u.permisosCount}</span>
                </td>
                <td className="py-3 text-gray-500 text-sm">{formatRelativeTime(u.ultimoAcceso)}</td>
                <td className="py-3"><span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${u.activo ? 'bg-green-500' : 'bg-gray-400'}`} />{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td className="py-3"><button onClick={() => alert('Editar usuario')} className="text-gray-500 hover:text-gray-700">Editar</button></td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="py-8 text-center text-gray-500">No hay miembros del equipo</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RolesTab({ roles }: { roles: { nombre: string; permisos: number }[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-1 gap-4">
      {roles.length > 0 ? roles.map((rol) => (
        <div key={rol.nombre} className="bg-white rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setExpanded(expanded === rol.nombre ? null : rol.nombre)}>
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg" style={{ color: ACCENT }}>{rol.nombre}</h3>
            <span className="text-gray-500">{expanded === rol.nombre ? '\u25B2' : '\u25BC'}</span>
          </div>
          <p className="text-gray-600">{rol.permisos} permisos asignados</p>
          {expanded === rol.nombre && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(permisosDetalle[rol.nombre] || {}).map(([cat, perms]) => (
                <div key={cat} className="bg-[#f8f6f6] rounded-lg p-3">
                  <p className="font-medium text-sm mb-1" style={{ color: ACCENT }}>{cat}</p>
                  {perms.map((p) => <span key={p} className="block text-xs text-gray-600">{p}</span>)}
                </div>
              ))}
            </div>
          )}
        </div>
      )) : (
        <div className="text-center text-gray-500 py-8">No hay roles configurados</div>
      )}
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

function AuditoriaTab({ loading, logs }: { loading: boolean; logs: LogDisplay[] }) {
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const usuariosUnicos = [...new Set(logs.map((l) => l.usuario))];
  const acciones = ['Creo', 'Modifico', 'Desactivo', 'Cambio', 'Actualizo', 'Invito'];

  const filtered = logs.filter((l) => {
    if (filtroUsuario && l.usuario !== filtroUsuario) return false;
    if (filtroAccion && !l.accion.toLowerCase().includes(filtroAccion.toLowerCase())) return false;
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
        <thead><tr className="text-left text-gray-600 border-b"><th className="pb-3 px-4 pt-4">Timestamp</th><th className="pb-3">Usuario</th><th className="pb-3">Accion</th></tr></thead>
        <tbody>
          {loading ? (
            [1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="border-b animate-pulse">
                <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                <td className="py-3"><div className="h-4 bg-gray-200 rounded w-40"></div></td>
                <td className="py-3"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
              </tr>
            ))
          ) : filtered.length > 0 ? (
            filtered.map((log, i) => (
              <tr key={i} className="border-b"><td className="py-3 px-4 text-gray-500 font-mono text-sm">{log.timestamp}</td><td className="py-3">{log.usuario}</td><td className="py-3">{log.accion}</td></tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="py-8 text-center text-gray-500">No hay registros de auditoria</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
