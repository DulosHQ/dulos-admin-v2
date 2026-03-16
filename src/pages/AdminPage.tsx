'use client';

import { useState, useEffect } from 'react';
import {
  fetchTeam,
  fetchAuditLogsByAction,
  TeamMember,
  AuditLog,
} from '../lib/supabase';

const ACCENT = '#E63946';

interface TeamDisplay {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  ultimoAcceso: number;
}

interface LogDisplay {
  timestamp: string;
  usuario: string;
  accion: string;
}

interface RoleDefinition {
  name: string;
  description: string;
  permissions: string[];
  color: string;
}

interface Setting {
  key: string;
  value: string;
  description: string;
}

const roleDefinitions: Record<string, RoleDefinition> = {
  'ADMIN': {
    name: 'Administrador',
    description: 'Acceso total al sistema',
    permissions: [
      'Gestión completa de usuarios',
      'Configuración del sistema',
      'Acceso a todos los eventos',
      'Gestión financiera completa',
      'Auditoría y reportes',
      'Gestión de roles y permisos',
      'Backup y recuperación',
      'Configuración de integraciones'
    ],
    color: 'bg-red-500'
  },
  'MANAGER': {
    name: 'Gerente',
    description: 'Gestión operativa y supervisión',
    permissions: [
      'Gestión de eventos',
      'Supervisión de ventas',
      'Reportes financieros',
      'Gestión de equipos',
      'Control de acceso a eventos',
      'Gestión de cupones',
      'Vista de auditoría básica'
    ],
    color: 'bg-blue-500'
  },
  'TAQUILLERO': {
    name: 'Taquillero',
    description: 'Venta de boletos y atención al cliente',
    permissions: [
      'Venta de boletos',
      'Consulta de eventos',
      'Aplicar cupones básicos',
      'Consulta de órdenes',
      'Check-in de boletos',
      'Atención al cliente básica'
    ],
    color: 'bg-green-500'
  }
};

const defaultSettings: Setting[] = [
  { key: 'company_name', value: 'Dulos Entertainment', description: 'Nombre de la empresa' },
  { key: 'default_currency', value: 'MXN', description: 'Moneda por defecto' },
  { key: 'timezone', value: 'America/Mexico_City', description: 'Zona horaria' },
  { key: 'email_notifications', value: 'true', description: 'Notificaciones por email' },
  { key: 'auto_checkin_window', value: '2', description: 'Ventana de check-in automático (horas)' },
  { key: 'max_tickets_per_order', value: '10', description: 'Máximo de boletos por orden' },
  { key: 'order_timeout_minutes', value: '15', description: 'Tiempo límite para completar orden (minutos)' },
];

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-1.5 px-2"><div className="h-3 bg-gray-200 rounded w-full"></div></td>
      ))}
    </tr>
  );
}

const formatRelativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000), hrs = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<TeamDisplay[]>([]);
  const [logs, setLogs] = useState<LogDisplay[]>([]);
  const [settings, setSettings] = useState<Setting[]>(defaultSettings);
  const [logFilter, setLogFilter] = useState<string>('');
  const [showInvite, setShowInvite] = useState(false);
  const [showRoleDetail, setShowRoleDetail] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editingSetting, setEditingSetting] = useState<Setting | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [teamData, auditData] = await Promise.all([
          fetchTeam().catch(() => []),
          fetchAuditLogsByAction(logFilter).catch(() => []),
        ]);

        setUsuarios(teamData.map((t) => ({
          id: t.id,
          nombre: t.name,
          email: t.email,
          rol: t.role,
          activo: t.is_active,
          ultimoAcceso: t.last_login ? new Date(t.last_login).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000,
        })));

        setLogs(auditData.map((l) => ({
          timestamp: new Date(l.created_at).toLocaleString('es-MX'),
          usuario: l.user_email,
          accion: `${l.action} ${l.entity_type}${l.entity_id ? ` (${l.entity_id})` : ''}`,
        })));

        // Load settings from localStorage
        const savedSettings = localStorage.getItem('dulos_admin_settings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading admin data:', error);
        setLoading(false);
      }
    }
    loadData();
  }, [logFilter]);

  const updateSetting = (key: string, value: string) => {
    const updatedSettings = settings.map(s => 
      s.key === key ? { ...s, value } : s
    );
    setSettings(updatedSettings);
    localStorage.setItem('dulos_admin_settings', JSON.stringify(updatedSettings));
  };

  return (
    <div className="bg-[#f8f6f6] p-4 max-w-7xl mx-auto">
      <h1 className="text-xl font-extrabold mb-4">Administración</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Roles Section */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-extrabold text-base">Roles del Sistema</h2>
              <button onClick={() => alert('Gestionar roles')} className="px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: ACCENT }}>Gestionar</button>
            </div>
            <div className="space-y-3">
              {Object.entries(roleDefinitions).map(([key, role]) => (
                <div key={key} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => setShowRoleDetail(key)}>
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${role.color}`}></span>
                    <div className="flex-1">
                      <p className="font-extrabold text-sm">{role.name}</p>
                      <p className="text-xs text-gray-500">{role.description}</p>
                    </div>
                    <span className="text-xs text-gray-400">{role.permissions.length} permisos</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settings Section */}
          <div className="bg-white rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-extrabold text-base">Configuración</h2>
              <button onClick={() => setShowSettings(true)} className="px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: ACCENT }}>Editar</button>
            </div>
            <div className="space-y-2">
              {settings.slice(0, 5).map(setting => (
                <div key={setting.key} className="flex justify-between items-center py-1.5">
                  <div>
                    <p className="text-sm font-bold">{setting.description}</p>
                    <p className="text-xs text-gray-500">{setting.value}</p>
                  </div>
                  <button 
                    onClick={() => setEditingSetting(setting)} 
                    className="text-xs text-[#E63946] hover:underline"
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Section */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-extrabold text-base">Equipo</h2>
            <button onClick={() => setShowInvite(true)} className="px-3 py-1.5 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: ACCENT }}>+ Invitar</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b text-xs">
                <th className="pb-2 font-bold">Nombre</th><th className="pb-2 font-bold">Rol</th><th className="pb-2 font-bold">Acceso</th><th className="pb-2 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => <SkeletonRow key={i} cols={4} />)
              ) : usuarios.length > 0 ? (
                usuarios.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">
                      <div className="font-bold text-sm leading-tight">{u.nombre}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[140px]">{u.email}</div>
                    </td>
                    <td className="py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold text-white ${roleDefinitions[u.rol]?.color || 'bg-gray-500'}`}>
                        {roleDefinitions[u.rol]?.name || u.rol}
                      </span>
                    </td>
                    <td className="py-1.5 text-gray-400 text-xs">{formatRelativeTime(u.ultimoAcceso)}</td>
                    <td className="py-1.5"><span className={`inline-block w-2 h-2 rounded-full ${u.activo ? 'bg-green-500' : 'bg-gray-400'}`} /></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="py-4 text-center text-gray-400 text-sm">No hay miembros</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Audit Logs Section */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-extrabold text-base">Auditoría</h2>
            <div className="flex gap-2">
              <select 
                value={logFilter} 
                onChange={e => setLogFilter(e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded text-xs"
              >
                <option value="">Todas las acciones</option>
                <option value="login">Inicios de sesión</option>
                <option value="create">Creaciones</option>
                <option value="update">Actualizaciones</option>
                <option value="delete">Eliminaciones</option>
                <option value="notification">Notificaciones</option>
              </select>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b text-xs">
                <th className="pb-2 font-bold">Fecha</th><th className="pb-2 font-bold">Usuario</th><th className="pb-2 font-bold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => <SkeletonRow key={i} cols={3} />)
              ) : logs.length > 0 ? (
                logs.map((log, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 text-gray-400 font-mono text-xs whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-1.5 text-xs truncate max-w-[120px] font-bold">{log.usuario}</td>
                    <td className="py-1.5 text-xs text-gray-600">{log.accion}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={3} className="py-4 text-center text-gray-400 text-sm">No hay registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Detail Modal */}
      {showRoleDetail && roleDefinitions[showRoleDetail] && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowRoleDetail(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className={`w-4 h-4 rounded-full ${roleDefinitions[showRoleDetail].color}`}></span>
              <h3 className="text-lg font-extrabold">{roleDefinitions[showRoleDetail].name}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">{roleDefinitions[showRoleDetail].description}</p>
            
            <h4 className="font-extrabold text-sm mb-2">Permisos:</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {roleDefinitions[showRoleDetail].permissions.map((permission, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  <span>{permission}</span>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2 justify-end mt-6">
              <button 
                onClick={() => setShowRoleDetail(null)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-4">Configuración del Sistema</h3>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {settings.map(setting => (
                <div key={setting.key} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-bold text-sm">{setting.description}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Clave: {setting.key}</p>
                    </div>
                    <button 
                      onClick={() => setEditingSetting(setting)}
                      className="text-xs text-[#E63946] hover:underline font-bold"
                    >
                      Editar
                    </button>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{setting.value}</p>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2 justify-end mt-6">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Setting Modal */}
      {editingSetting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditingSetting(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-4">Editar Configuración</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{editingSetting.description}</label>
                <input 
                  type="text"
                  value={editingSetting.value}
                  onChange={e => setEditingSetting({...editingSetting, value: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E63946] focus:border-[#E63946]"
                />
                <p className="text-xs text-gray-500 mt-1">Clave: {editingSetting.key}</p>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end mt-6">
              <button 
                onClick={() => setEditingSetting(null)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-bold"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  updateSetting(editingSetting.key, editingSetting.value);
                  setEditingSetting(null);
                }}
                className="px-4 py-2 rounded-lg text-white text-sm font-bold"
                style={{ backgroundColor: ACCENT }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-extrabold text-base mb-3">Invitar usuario</h3>
            <input type="email" placeholder="Email" className="w-full border rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-[#E63946] focus:border-[#E63946]" />
            <select className="w-full border rounded-lg px-3 py-1.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-[#E63946] focus:border-[#E63946]">
              <option value="ADMIN">Administrador</option>
              <option value="MANAGER">Gerente</option>
              <option value="TAQUILLERO">Taquillero</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowInvite(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
              <button onClick={() => { alert('Invitación enviada'); setShowInvite(false); }} className="px-3 py-1.5 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: ACCENT }}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}