'use client';

import React, { useState, useEffect } from 'react';
import {
  fetchScheduleInventory,
  fetchZones,
  TicketZone,
  ScheduleInventory,
} from '../lib/supabase';

/* ─── Types ─── */
interface FunctionDetailProps {
  scheduleId: string;
  eventId: string;
  eventName: string;
  venueName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface ZoneInfo {
  zone_name: string;
  zone_type: string;
  capacity: number;
  sold: number;
  available: number;
}

/* ─── Helpers ─── */
const fmtDate = (d: string) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return '—'; }
};
const fmtTime = (t: string) => (t ? t.slice(0, 5) : '');

/* ─── Component ─── */
export default function FunctionDetail({
  scheduleId,
  eventId,
  eventName,
  venueName,
  date,
  startTime,
  endTime,
  status,
}: FunctionDetailProps) {
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<ZoneInfo[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [inventory, eventZones] = await Promise.all([
          fetchScheduleInventory(scheduleId),
          fetchZones(eventId),
        ]);

        if (cancelled) return;

        // ── Zone Info (capacity only) ──
        const zoneMap = new Map<string, TicketZone & { id?: string }>();
        eventZones.forEach((z: TicketZone & { id?: string }) => {
          if (z.id) zoneMap.set(z.id, z);
        });

        const zoneInfo: ZoneInfo[] = [];

        if (inventory.length > 0) {
          // Use schedule_inventory for per-function data
          inventory.forEach((si: ScheduleInventory) => {
            const tz = zoneMap.get(si.zone_id);
            const cap = si.total_capacity || si.sold + si.available || 0;
            const sold = si.sold || 0;
            const avail = si.available || 0;
            
            zoneInfo.push({
              zone_name: tz?.zone_name || 'Zona',
              zone_type: tz?.zone_type || 'general',
              capacity: cap,
              sold,
              available: avail,
            });
          });
        } else {
          // Fall back to event-level zones
          eventZones.forEach((tz: TicketZone) => {
            const cap = (tz.available || 0) + (tz.sold || 0);
            zoneInfo.push({
              zone_name: tz.zone_name,
              zone_type: tz.zone_type || 'general',
              capacity: cap,
              sold: tz.sold || 0,
              available: tz.available || 0,
            });
          });
        }
        setZones(zoneInfo);
      } catch (err) {
        console.error('FunctionDetail load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [scheduleId, eventId]);

  if (loading) {
    return (
      <div className="border-t border-gray-800 px-4 py-6 animate-pulse space-y-3">
        <div className="h-4 bg-gray-800 rounded w-1/3" />
        <div className="h-3 bg-gray-800 rounded w-1/2" />
        <div className="h-20 bg-gray-800 rounded" />
        <div className="h-3 bg-gray-800 rounded w-1/4" />
      </div>
    );
  }

  return (
    <div className="border-t border-gray-800 px-4 py-4 space-y-5 animate-fade-in">
      {/* ─── 1. Basic Info ─── */}
      <div className="bg-[#1a1a1a] rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">{eventName}</h3>
            <p className="text-sm text-gray-400">
              {venueName} · {fmtDate(date)} · {fmtTime(startTime)}
              {endTime ? ` — ${fmtTime(endTime)}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                status === 'active'
                  ? 'bg-green-900/50 text-green-400'
                  : status === 'cancelled'
                  ? 'bg-red-900/50 text-red-400'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {status === 'active' ? 'Activo' : status === 'cancelled' ? 'Cancelado' : 'Cerrado'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. Zone Status ─── */}
      {zones.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Estado de Zonas
          </h4>
          <div className="bg-[#1a1a1a] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left px-3 py-2.5 font-medium">Zona</th>
                  <th className="text-center px-2 py-2.5 font-medium hidden sm:table-cell">Tipo</th>
                  <th className="text-right px-2 py-2.5 font-medium">Vendidos</th>
                  <th className="text-right px-2 py-2.5 font-medium hidden sm:table-cell">Disponibles</th>
                  <th className="text-right px-2 py-2.5 font-medium">Capacidad</th>
                  <th className="text-right px-3 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z, i) => {
                  const pct = z.capacity > 0 ? (z.sold / z.capacity) * 100 : 0;
                  const status = pct >= 95 ? 'Agotado' : pct >= 80 ? 'Casi lleno' : pct >= 50 ? 'Medio' : 'Disponible';
                  const statusColor = pct >= 95 ? 'text-red-400' : pct >= 80 ? 'text-yellow-400' : pct >= 50 ? 'text-blue-400' : 'text-green-400';
                  
                  return (
                    <tr key={i} className="border-b border-gray-800/50 last:border-0">
                      <td className="px-3 py-2.5 text-white font-medium">{z.zone_name}</td>
                      <td className="px-2 py-2.5 text-center hidden sm:table-cell">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            z.zone_type === 'general' || z.zone_type === 'ga'
                              ? 'bg-green-900/40 text-green-400'
                              : 'bg-orange-900/40 text-orange-400'
                          }`}
                        >
                          {z.zone_type === 'general' || z.zone_type === 'ga' ? 'GA' : 'RES'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right text-white font-medium">{z.sold}</td>
                      <td className="px-2 py-2.5 text-right text-gray-400 hidden sm:table-cell">
                        {z.available}
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-400">{z.capacity}</td>
                      <td className={`px-3 py-2.5 text-right font-medium ${statusColor}`}>
                        {status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-700">
                  <td colSpan={2} className="px-3 py-2.5 text-white font-bold text-xs hidden sm:table-cell">
                    Total
                  </td>
                  <td colSpan={1} className="px-3 py-2.5 text-white font-bold text-xs sm:hidden">
                    Total
                  </td>
                  <td className="px-2 py-2.5 text-right text-white font-bold text-xs">
                    {zones.reduce((s, z) => s + z.sold, 0)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-white font-bold text-xs hidden sm:table-cell">
                    {zones.reduce((s, z) => s + z.available, 0)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-white font-bold text-xs">
                    {zones.reduce((s, z) => s + z.capacity, 0)}
                  </td>
                  <td className="px-3 py-2.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}