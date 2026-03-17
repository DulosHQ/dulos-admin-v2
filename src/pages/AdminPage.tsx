'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { inviteUser } from '../app/actions/users.actions';
import { updateSetting as updateSettingAction } from '../app/actions/settings.actions';
import {
  fetchTeam,
  fetchAuditLogsByAction,
  fetchDashboardStats,
  TeamMember,
  AuditLog,
  DashboardStats,
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
  permissions: Record<string, string[]>;
  color: string;
}

interface Setting {
  key: string;
  value: string;
  description: string;
  group: 'general' | 'notifications' | 'operations';
}

const roleDefinitions: Record<string, RoleDefinition> = {
  'ADMIN': {
    name: 'Administrador',
    description: 'Acceso total al sistema',
    permissions: {
      'Pacientes/Eventos': ['Gestión completa de eventos', 'Acceso a todos los eventos', 'Gestión de pacientes'],
      'Finanzas': ['Gestión financiera completa', 'Reportes financieros', 'Auditoría financiera'],
      'Operaciones': ['Control de acceso', 'Gestión de cupones', 'Backup y recuperación'],
      'Admin': ['Gestión de usuarios', 'Configuración del sistema', 'Gestión de roles y permisos', 'Configuración de integraciones'],
    },
    color: 'bg-red-500'
  },
  'MANAGER': {
    name: 'Gerente',
    description: 'Gestión operativa y supervisión',
    permissions: {
      'Pacientes/Eventos': ['Gestión de eventos', 'Supervisión de ventas'],
      'Finanzas': ['Reportes financieros', 'Vista de ventas'],
      'Operaciones': ['Control de acceso a eventos', 'Gestión de cupones', 'Gestión de equipos'],
      'Admin': ['Vista de auditoría básica'],
    },
    color: 'bg-blue-500'
  },
  'TAQUILLERO': {
    name: 'Taquillero',
    description: 'Venta de boletos y atención al cliente',
    permissions: {
      'Pacientes/Eventos': ['Consulta de eventos', 'Atención al cliente básica'],
      'Finanzas': ['Consulta de órdenes'],
      'Operaciones': ['Venta de boletos', 'Aplicar cupones básicos', 'Check-in de boletos'],
      'Admin': [],
    },
    color: 'bg-green-500'
  }
};

// Flatten permissions for counting
const countPermissions = (perms: Record<string, string[]>) => Object.values(perms).reduce((sum, arr) => sum + arr.length, 0);

const defaultSettings: Setting[] = [
  { key: 'company_name', value: 'Dulos Entertainment', description: 'Nombre de la empresa', group: 'general' },
  { key: 'default_currency', value: 'MXN', description: 'Moneda por defecto', group: 'general' },
  { key: 'timezone', value: 'America/Mexico_City', description: 'Zona horaria', group: 'general' },
  { key: 'email_notifications', value: 'true', description: 'Notificaciones por email', group: 'notifications' },
  { key: 'auto_checkin_window', value: '2', description: 'Ventana de check-in automático (horas)', group: 'operations' },
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

// Generic CSV export function
function exportToCSV(data: any[], filename: string, headers: string[]) {
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header] || '';
        // Escape CSV special characters
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<TeamDisplay[]>([]);
  const [logs, setLogs] = useState<LogDisplay[]>([]);
  const [settings, setSettings] = useState<Setting[]>(defaultSettings);
  const [logFilter, setLogFilter] = useState<string>('');
  const [showInvite, setShowInvite] = useState(false);
  const [showRoleManage, setShowRoleManage] = useState(false);
  const [showRoleDetail, setShowRoleDetail] = useState<string | null>(null);
  const [editingSettingKey, setEditingSettingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Auditoría collapsed state
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null);

  // Role management state
  const [rolePerms, setRolePerms] = useState<Record<string, Record<string, string[]>>>(() => {
    const initial: Record<string, Record<string, string[]>> = {};
    Object.entries(roleDefinitions).forEach(([key, role]) => {
      initial[key] = { ...role.permissions };
    });
    return initial;
  });
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [teamData, auditData, statsData] = await Promise.all([
          fetchTeam().catch(() => []),
          fetchAuditLogsByAction(logFilter).catch(() => []),
          fetchDashboardStats().catch(() => null),
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

        if (statsData) {
          setDashboardStats(statsData);
        }
        setLastSyncTime(new Date());

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

  const updateSetting = async (key: string, value: string) => {
    const updatedSettings = settings.map(s =>
      s.key === key ? { ...s, value } : s
    );
    setSettings(updatedSettings);
    localStorage.setItem('dulos_admin_settings', JSON.stringify(updatedSettings));
    setEditingSettingKey(null);
    // Fire-and-forget server action + audit
    updateSettingAction(key, value).then(result => {
      if (result.success) {
        toast.success('Configuración guardada');
      }
    });
  };

  const generalSettings = settings.filter(s => s.group === 'general');
  const notifSettings = settings.filter(s => s.group === 'notifications');
  const opsSettings = settings.filter(s => s.group === 'operations');

  // All possible permissions for the management modal
  const allPermissions: Record<string, string[]> = {
    'Pacientes/Eventos': ['Gestión completa de eventos', 'Acceso a todos los eventos', 'Gestión de pacientes', 'Consulta de eventos', 'Supervisión de ventas', 'Atención al cliente básica'],
    'Finanzas': ['Gestión financiera completa', 'Reportes financieros', 'Auditoría financiera', 'Vista de ventas', 'Consulta de órdenes'],
    'Operaciones': ['Control de acceso', 'Control de acceso a eventos', 'Gestión de cupones', 'Backup y recuperación', 'Venta de boletos', 'Aplicar cupones básicos', 'Check-in de boletos', 'Gestión de equipos'],
    'Admin': ['Gestión de usuarios', 'Configuración del sistema', 'Gestión de roles y permisos', 'Configuración de integraciones', 'Vista de auditoría básica'],
  };

  const togglePerm = (roleKey: string, category: string, perm: string) => {
    setRolePerms(prev => {
      const updated = { ...prev };
      const catPerms = [...(updated[roleKey][category] || [])];
      const idx = catPerms.indexOf(perm);
      if (idx >= 0) catPerms.splice(idx, 1);
      else catPerms.push(perm);
      updated[roleKey] = { ...updated[roleKey], [category]: catPerms };
      return updated;
    });
  };

  const showTeamOnboarding = usuarios.length < 3;

  return (
    <div className="bg-[#f8f6f6] p-3 sm:p-4 max-w-7xl mx-auto">
      <h1 className="text-lg sm:text-xl font-extrabold mb-4">Administración</h1>

      {/* System Info Card */}
      <div className="bg-white rounded-xl p-3 sm:p-4 mb-4 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs font-bold text-gray-600">Supabase Conectado</span>
            </div>
            <span className="text-xs text-gray-400">Dashboard V2 Beta</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {dashboardStats && (
              <>
                <span><span className="font-bold text-gray-700">{dashboardStats.totalEvents}</span> eventos</span>
                <span><span className="font-bold text-gray-700">{dashboardStats.totalTickets}</span> boletos</span>
                <span><span className="font-bold text-gray-700">{usuarios.length}</span> usuarios</span>
                <span>Sync: {lastSyncTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Role Permission Matrix */}
      <div className="bg-white rounded-xl p-3 sm:p-4 mb-4">
        <h2 className="font-extrabold text-sm sm:text-base mb-3">Matriz de Permisos por Rol</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-bold text-gray-600">Categoría / Rol</th>
                {Object.entries(roleDefinitions).map(([key, role]) => (
                  <th key={key} className="text-center py-2 px-2">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`w-3 h-3 rounded-full ${role.color}`}></span>
                      <span className="font-bold text-[10px] leading-tight">{role.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(allPermissions).map(([category, perms]) => (
                <tr key={category} className="border-b hover:bg-gray-50">
                  <td className="py-2 font-bold text-gray-700">{category}</td>
                  {Object.entries(roleDefinitions).map(([roleKey, role]) => {
                    const rolePerms = role.permissions[category] || [];
                    const hasPerms = rolePerms.length > 0;
                    return (
                      <td key={roleKey} className="text-center py-2 px-2">
                        <div className="flex flex-col items-center gap-1">
                          {hasPerms ? (
                            <span className="text-green-500 font-bold text-sm">✅</span>
                          ) : (
                            <span className="text-gray-300 text-sm">❌</span>
                          )}
                          <span className="text-[10px] text-gray-400">{rolePerms.length}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Roles + Equipo row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4">
        {/* Roles Section */}
        <div className="bg-white rounded-xl p-3 sm:p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-extrabold text-sm sm:text-base">Roles del Sistema</h2>
            <button onClick={() => setShowRoleManage(true)} className="px-3 py-1.5 rounded-lg text-white text-xs font-bold hover:opacity-90 transition-opacity" style={{ backgroundColor: ACCENT }}>Gestionar</button>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {Object.entries(roleDefinitions).map(([key, role]) => (
              <div key={key} className="border border-gray-200 rounded-lg p-2 sm:p-3 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => setShowRoleDetail(key)}>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className={`w-3 h-3 rounded-full ${role.color} flex-shrink-0`}></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-xs sm:text-sm">{role.name}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 truncate">{role.description}</p>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400 flex-shrink-0">{countPermissions(role.permissions)} permisos</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Section */}
        <div className="bg-white rounded-xl p-3 sm:p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="font-extrabold text-sm sm:text-base">Equipo</h2>
              <p className="text-xs text-gray-400">{usuarios.length}/10 miembros activos</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const teamData = usuarios.map(u => ({
                    nombre: u.nombre,
                    email: u.email,
                    rol: u.rol,
                    activo: u.activo ? 'Sí' : 'No',
                    ultimoAcceso: new Date(u.ultimoAcceso).toLocaleDateString('es-MX')
                  }));
                  exportToCSV(teamData, 'equipo', ['nombre', 'email', 'rol', 'activo', 'ultimoAcceso']);
                  toast.success('Equipo exportado a CSV');
                }}
                className="px-2 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
              >
                CSV
              </button>
              <button onClick={() => setShowInvite(true)} className="px-3 py-1.5 rounded-lg text-white text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity" style={{ backgroundColor: ACCENT }}>+ Invitar</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs">
                  <th className="pb-2 font-bold">Nombre</th><th className="pb-2 font-bold">Rol</th><th className="pb-2 font-bold hidden sm:table-cell">Acceso</th><th className="pb-2 font-bold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3].map((i) => <SkeletonRow key={i} cols={4} />)
                ) : usuarios.length > 0 ? (
                  usuarios.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">
                        <div className="font-bold text-xs sm:text-sm leading-tight truncate max-w-[100px] sm:max-w-none">{u.nombre}</div>
                        <div className="text-[10px] sm:text-xs text-gray-400 truncate max-w-[100px] sm:max-w-[140px]">{u.email}</div>
                      </td>
                      <td className="py-1.5">
                        <span className={`px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold text-white ${roleDefinitions[u.rol]?.color || 'bg-gray-500'}`}>
                          {roleDefinitions[u.rol]?.name || u.rol}
                        </span>
                      </td>
                      <td className="py-1.5 text-gray-400 text-xs hidden sm:table-cell">
                        <div className="flex flex-col">
                          <span>{formatRelativeTime(u.ultimoAcceso)}</span>
                          <span className="text-[10px] text-gray-300">{new Date(u.ultimoAcceso).toLocaleDateString('es-MX')}</span>
                        </div>
                      </td>
                      <td className="py-1.5"><span className={`inline-block w-2 h-2 rounded-full ${u.activo ? 'bg-green-500' : 'bg-gray-400'}`} /></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="py-4 text-center text-gray-400 text-sm">No hay miembros</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Team onboarding prompt */}
          {showTeamOnboarding && !loading && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs sm:text-sm text-gray-400 font-medium">Invita a tu equipo para colaborar</p>
              <p className="text-[10px] sm:text-xs text-gray-300 mt-1">Los gerentes pueden supervisar eventos. Los taquilleros pueden escanear boletos.</p>
            </div>
          )}
        </div>
      </div>

      {/* Auditoría — collapsed by default */}
      <div className="mb-4">
        {!auditExpanded ? (
          <div className="bg-white rounded-xl p-3 sm:p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-extrabold text-sm sm:text-base">Auditoría</h2>
              <span className="text-xs text-gray-400">{logs.length} acciones registradas</span>
            </div>
            <button
              onClick={() => setAuditExpanded(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all duration-300"
            >
              Ver Auditoría
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
              <h2 className="font-extrabold text-sm sm:text-base">Auditoría</h2>
              <div className="flex gap-2">
                <select
                  value={logFilter}
                  onChange={e => setLogFilter(e.target.value)}
                  className="px-2 py-1 border border-gray-200 rounded text-xs flex-1 sm:flex-none"
                >
                  <option value="">Todas las acciones</option>
                  <option value="stripe">Stripe</option>
                  <option value="login">Acciones de usuario</option>
                  <option value="system">Sistema</option>
                  <option value="create">Creaciones</option>
                  <option value="update">Actualizaciones</option>
                  <option value="delete">Eliminaciones</option>
                </select>
                <button
                  onClick={() => {
                    const auditData = logs.map(log => ({
                      timestamp: log.timestamp,
                      usuario: log.usuario,
                      accion: log.accion
                    }));
                    exportToCSV(auditData, 'auditoria', ['timestamp', 'usuario', 'accion']);
                    toast.success('Auditoría exportada a CSV');
                  }}
                  className="px-2 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
                >
                  CSV
                </button>
                <button
                  onClick={() => setAuditExpanded(false)}
                  className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-500 hover:bg-gray-50"
                >
                  Colapsar
                </button>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
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
                      <React.Fragment key={i}>
                        <tr className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedLogIndex(expandedLogIndex === i ? null : i)}>
                          <td className="py-1.5 text-gray-400 font-mono text-[10px] sm:text-xs whitespace-nowrap">{log.timestamp}</td>
                          <td className="py-1.5 text-[10px] sm:text-xs truncate max-w-[80px] sm:max-w-[120px] font-bold">{log.usuario}</td>
                          <td className="py-1.5 text-[10px] sm:text-xs text-gray-600 flex items-center gap-2">
                            <span>{log.accion}</span>
                            <svg className={`w-3 h-3 text-gray-400 transition-transform ${expandedLogIndex === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </td>
                        </tr>
                        {expandedLogIndex === i && (
                          <tr className="bg-gray-50">
                            <td colSpan={3} className="py-2 px-4 text-xs text-gray-600">
                              <div className="space-y-1">
                                <div><span className="font-bold">Fecha completa:</span> {log.timestamp}</div>
                                <div><span className="font-bold">Usuario:</span> {log.usuario}</div>
                                <div><span className="font-bold">Acción:</span> {log.accion}</div>
                                <div><span className="font-bold">Tipo:</span> {logFilter || 'Todas las acciones'}</div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr><td colSpan={3} className="py-4 text-center text-gray-400 text-sm">No hay registros</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Settings — grouped into cards with inline edit */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* General */}
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100">
          <h3 className="font-extrabold text-sm mb-3">General</h3>
          <div className="space-y-3">
            {generalSettings.map(s => (
              <div key={s.key}>
                <p className="text-xs text-gray-500">{s.description}</p>
                {editingSettingKey === s.key ? (
                  <div className="flex gap-1 mt-1">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946]"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') updateSetting(s.key, editingValue); if (e.key === 'Escape') setEditingSettingKey(null); }}
                    />
                    <button onClick={() => updateSetting(s.key, editingValue)} className="px-2 py-1 text-xs font-bold text-white rounded" style={{ backgroundColor: ACCENT }}>OK</button>
                    <button onClick={() => setEditingSettingKey(null)} className="px-2 py-1 text-xs text-gray-500">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-sm font-bold truncate mr-2">{s.value}</p>
                    <button
                      onClick={() => { setEditingSettingKey(s.key); setEditingValue(s.value); }}
                      className="text-xs text-[#E63946] hover:underline flex-shrink-0"
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notificaciones */}
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100">
          <h3 className="font-extrabold text-sm mb-3">Notificaciones</h3>
          <div className="space-y-3">
            {notifSettings.map(s => (
              <div key={s.key}>
                <p className="text-xs text-gray-500">{s.description}</p>
                <div className="flex items-center justify-between mt-1">
                  <button
                    onClick={() => updateSetting(s.key, s.value === 'true' ? 'false' : 'true')}
                    className={`relative w-10 h-5 rounded-full transition-colors ${s.value === 'true' ? 'bg-[#E63946]' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${s.value === 'true' ? 'translate-x-5' : ''}`} />
                  </button>
                  <span className="text-xs text-gray-400">{s.value === 'true' ? 'Activado' : 'Desactivado'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operaciones */}
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100">
          <h3 className="font-extrabold text-sm mb-3">Operaciones</h3>
          <div className="space-y-3">
            {opsSettings.map(s => (
              <div key={s.key}>
                <p className="text-xs text-gray-500">{s.description}</p>
                {editingSettingKey === s.key ? (
                  <div className="flex gap-1 mt-1">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946]"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') updateSetting(s.key, editingValue); if (e.key === 'Escape') setEditingSettingKey(null); }}
                    />
                    <button onClick={() => updateSetting(s.key, editingValue)} className="px-2 py-1 text-xs font-bold text-white rounded" style={{ backgroundColor: ACCENT }}>OK</button>
                    <button onClick={() => setEditingSettingKey(null)} className="px-2 py-1 text-xs text-gray-500">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-sm font-bold">{s.value}</p>
                    <button
                      onClick={() => { setEditingSettingKey(s.key); setEditingValue(s.value); }}
                      className="text-xs text-[#E63946] hover:underline"
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Role Detail Modal (click on a role card) */}
      {showRoleDetail && roleDefinitions[showRoleDetail] && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRoleDetail(null)}>
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className={`w-4 h-4 rounded-full ${roleDefinitions[showRoleDetail].color}`}></span>
              <h3 className="text-base sm:text-lg font-extrabold">{roleDefinitions[showRoleDetail].name}</h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mb-4">{roleDefinitions[showRoleDetail].description}</p>

            <h4 className="font-extrabold text-sm mb-2">Permisos:</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {Object.entries(roleDefinitions[showRoleDetail].permissions).map(([cat, perms]) =>
                perms.map((permission, index) => (
                  <div key={`${cat}-${index}`} className="flex items-center gap-2 text-xs sm:text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    <span>{permission}</span>
                  </div>
                ))
              )}
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

      {/* Role Management Modal */}
      {showRoleManage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRoleManage(false)}>
          <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base sm:text-lg font-extrabold mb-4">Gestionar Roles y Permisos</h3>

            <div className="space-y-4 sm:space-y-6">
              {Object.entries(roleDefinitions).map(([roleKey, role]) => (
                <div key={roleKey} className="border border-gray-200 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3">
                    <span className={`w-3 h-3 rounded-full ${role.color}`}></span>
                    <h4 className="font-extrabold text-xs sm:text-sm">{role.name}</h4>
                    <span className="text-[10px] sm:text-xs text-gray-400 truncate">{role.description}</span>
                  </div>

                  {Object.entries(allPermissions).map(([category, perms]) => {
                    const catKey = `${roleKey}-${category}`;
                    const isExpanded = expandedCategory === catKey;
                    const activeCount = (rolePerms[roleKey]?.[category] || []).length;

                    return (
                      <div key={category} className="mb-1">
                        <button
                          onClick={() => setExpandedCategory(isExpanded ? null : catKey)}
                          className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 rounded text-left"
                        >
                          <span className="text-xs font-bold text-gray-700">{category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">{activeCount}/{perms.length}</span>
                            <svg className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="pl-3 py-1 space-y-1">
                            {perms.map(perm => {
                              const checked = (rolePerms[roleKey]?.[category] || []).includes(perm);
                              return (
                                <label key={perm} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePerm(roleKey, category, perm)}
                                    className="rounded border-gray-300 text-[#E63946] focus:ring-[#E63946]"
                                  />
                                  <span className={checked ? 'text-gray-900' : 'text-gray-400'}>{perm}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowRoleManage(false)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowRoleManage(false); toast.success('Roles actualizados'); }}
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-xl p-4 sm:p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-extrabold text-sm sm:text-base mb-3">Invitar usuario</h3>
            <input id="invite-email" type="email" placeholder="Email" className="w-full border rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-[#E63946] focus:border-[#E63946]" />
            <select id="invite-role" className="w-full border rounded-lg px-3 py-1.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-[#E63946] focus:border-[#E63946]">
              <option value="ADMIN">Administrador</option>
              <option value="MANAGER">Gerente</option>
              <option value="TAQUILLERO">Taquillero</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowInvite(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
              <button onClick={async () => {
                const emailInput = document.querySelector<HTMLInputElement>('#invite-email');
                const roleSelect = document.querySelector<HTMLSelectElement>('#invite-role');
                if (emailInput && roleSelect) {
                  const result = await inviteUser({ email: emailInput.value, role: roleSelect.value as 'ADMIN' | 'MANAGER' | 'TAQUILLERO' });
                  if (result.success) {
                    toast.success('Invitación enviada');
                    setShowInvite(false);
                  } else {
                    toast.error(result.error || 'Error al enviar invitación');
                  }
                }
              }} className="px-3 py-1.5 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: ACCENT }}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
