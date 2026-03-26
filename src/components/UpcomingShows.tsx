'use client';

import React from 'react';

interface Show {
  name: string;
  venue: string;
  date: string;
  occupancy: number;
  remaining: number;
  emoji?: string;
}

interface UpcomingShowsProps {
  shows: Show[];
}

function getOccupancyColor(occupancy: number): string {
  if (occupancy < 50) return 'bg-green-500';
  if (occupancy < 80) return 'bg-yellow-500';
  return 'bg-[#EF4444]';
}

function getOccupancyTextColor(occupancy: number): string {
  if (occupancy < 50) return 'text-green-600';
  if (occupancy < 80) return 'text-yellow-600';
  return 'text-[#EF4444]';
}

function getUrgencyBadge(occupancy: number, remaining: number) {
  if (remaining <= 10) {
    return (
      <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
        ¡Últimos lugares!
      </span>
    );
  }
  if (occupancy >= 80) {
    return (
      <span className="px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-700 rounded-full">
        Casi lleno
      </span>
    );
  }
  if (occupancy >= 50) {
    return (
      <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded-full">
        Vendiendo rápido
      </span>
    );
  }
  return (
    <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
      Disponible
    </span>
  );
}

function formatDate(dateString: string): string {
  if (!dateString) return 'TBD';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  };
  return date.toLocaleDateString('es-MX', options);
}

function ShowRow({ show }: { show: Show }) {
  const emoji = show.emoji || '🎭';

  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 border-b border-gray-800 gap-4">
      {/* Left: Event info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-2xl flex-shrink-0">{emoji}</span>
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">{show.name}</p>
          <p className="text-sm text-gray-500">{show.venue}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(show.date)}</p>
        </div>
      </div>

      {/* Center: Occupancy bar */}
      <div className="flex-1 max-w-[200px] px-4">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-sm font-medium ${getOccupancyTextColor(show.occupancy)}`}>
            {show.occupancy}% ocupado
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getOccupancyColor(show.occupancy)}`}
            style={{ width: `${Math.min(show.occupancy, 100)}%` }}
          />
        </div>
      </div>

      {/* Right: Remaining + Badge */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-sm font-medium text-white">
            {show.remaining.toLocaleString('es-MX')} restantes
          </p>
        </div>
        {getUrgencyBadge(show.occupancy, show.remaining)}
      </div>
    </div>
  );
}

export default function UpcomingShows({ shows }: UpcomingShowsProps) {
  if (!shows || shows.length === 0) {
    return (
      <div className="bg-[#111] rounded-xl shadow-sm border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Funciones Próximas (48h)
        </h2>
        <p className="text-gray-500 text-center py-8">
          No hay funciones programadas en las próximas 48 horas.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#111] rounded-xl shadow-sm border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          Funciones Próximas (48h)
        </h2>
        <span className="text-sm text-gray-500">
          {shows.length} {shows.length === 1 ? 'función' : 'funciones'}
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {shows.map((show, index) => (
          <ShowRow key={index} show={show} />
        ))}
      </div>
    </div>
  );
}
