'use client';

import { useState, useEffect } from 'react';
import {
  fetchTeam,
  fetchAuditLogs,
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

const permisosCount: Record<string, number> = {
  ADMIN: 24,
  OPERADOR: 12,
  PRODUCTOR: 8,
  TAQUILLERO: 6,
  SOPORTE: 4,
};

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
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [teamData, auditData] = await Promise.all([
          fetchTeam().catch(() => []),
          fetchAuditLogs().catch(() => []),
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
      <h1 className="text-2xl font-bold mb-4">Administracion</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Team */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-base">Equipo</h2>
            <button onClick={() => setShowInvite(true)} className="px-3 py-1.5 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: ACCENT }}>+ Invitar</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b text-xs">
                <th className="pb-2">Nombre</th><th className="pb-2">Rol</th><th className="pb-2">Acceso</th><th className="pb-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => <SkeletonRow key={i} cols={4} />)
              ) : usuarios.length > 0 ? (
                usuarios.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">
                      <div className="font-medium text-sm leading-tight">{u.nombre}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[140px]">{u.email}</div>
                    </td>
                    <td className="py-1.5"><span className="px-1.5 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: ACCENT }}>{u.rol}</span></td>
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

        {/* Audit Logs */}
        <div className="bg-white rounded-xl p-4">
          <h2 className="font-bold text-base mb-3">Auditoria</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b text-xs">
                <th className="pb-2">Fecha</th><th className="pb-2">Usuario</th><th className="pb-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => <SkeletonRow key={i} cols={3} />)
              ) : logs.length > 0 ? (
                logs.map((log, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 text-gray-400 font-mono text-xs whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-1.5 text-xs truncate max-w-[120px]">{log.usuario}</td>
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

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-3">Invitar usuario</h3>
            <input type="email" placeholder="Email" className="w-full border rounded-lg px-3 py-1.5 text-sm mb-2" />
            <select className="w-full border rounded-lg px-3 py-1.5 text-sm mb-3">
              <option>ADMIN</option><option>OPERADOR</option><option>PRODUCTOR</option><option>TAQUILLERO</option><option>SOPORTE</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowInvite(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
              <button onClick={() => { alert('Invitacion enviada'); setShowInvite(false); }} className="px-3 py-1.5 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: ACCENT }}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
