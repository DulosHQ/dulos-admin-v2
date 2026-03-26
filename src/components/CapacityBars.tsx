'use client';

import React from 'react';

interface Schedule {
  name: string;
  date: string;
  capacity: number;
  sold: number;
  percentage: number;
  eventId?: string;
}

interface ZoneBreakdown {
  zone_name: string;
  sold: number;
  total: number;
  percentage: number;
}

interface CapacityBarsProps {
  schedules: Schedule[];
  zonesByEvent?: Record<string, ZoneBreakdown[]>;
  expandedIndex?: number | null;
  onToggle?: (index: number) => void;
}

function getStatusConfig(percentage: number): {
  barColor: string;
  badgeColor: string;
  badgeText: string;
} {
  if (percentage > 80) {
    return {
      barColor: 'bg-[#EF4444]',
      badgeColor: 'bg-red-100 text-red-800',
      badgeText: 'CRITICO',
    };
  }
  if (percentage >= 50) {
    return {
      barColor: 'bg-yellow-500',
      badgeColor: 'bg-yellow-100 text-yellow-800',
      badgeText: 'ALTO',
    };
  }
  return {
    barColor: 'bg-green-500',
    badgeColor: 'bg-green-100 text-green-800',
    badgeText: 'NORMAL',
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function CapacityRow({
  schedule,
  isExpanded,
  onToggle,
  zones,
}: {
  schedule: Schedule;
  isExpanded: boolean;
  onToggle?: () => void;
  zones?: ZoneBreakdown[];
}) {
  const { barColor, badgeColor, badgeText } = getStatusConfig(schedule.percentage);
  const isExpandable = onToggle && zones && zones.length > 0;

  return (
    <div>
      <div
        className={`bg-[#111] rounded-xl shadow-sm p-4 flex items-center gap-4 transition-colors ${
          isExpandable ? 'cursor-pointer hover:bg-[#0d0d0d]' : ''
        }`}
        onClick={onToggle}
      >
        <div className="w-full sm:w-48 flex-shrink-0">
          <p className="font-medium text-white text-sm truncate">{schedule.name}</p>
          <p className="text-xs text-gray-500">{formatDate(schedule.date)}</p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(schedule.percentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {schedule.sold.toLocaleString('es-MX')} / {schedule.capacity.toLocaleString('es-MX')} lugares
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-lg font-bold text-white w-14 text-right">
            {schedule.percentage.toFixed(0)}%
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeColor} w-20 text-center`}
          >
            {badgeText}
          </span>
          {isExpandable && (
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>

      {/* Zone breakdown */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded && zones && zones.length > 0 ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="ml-4 mr-4 space-y-2 pb-2">
          {zones?.map((zone) => {
            const config = getStatusConfig(zone.percentage);
            return (
              <div key={zone.zone_name} className="bg-[#0d0d0d] rounded-lg p-3 flex items-center gap-3">
                <span className="w-32 text-sm font-medium text-gray-300 truncate">{zone.zone_name}</span>
                <div className="flex-1">
                  <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.barColor} rounded-full transition-all duration-300`}
                      style={{ width: `${Math.min(zone.percentage, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-400 w-24 text-right">
                  {zone.sold.toLocaleString('es-MX')}/{zone.total.toLocaleString('es-MX')}
                </span>
                <span className="text-sm font-bold w-12 text-right">{zone.percentage.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CapacityBars({ schedules, zonesByEvent, expandedIndex, onToggle }: CapacityBarsProps) {
  if (!schedules || schedules.length === 0) {
    return (
      <div className="bg-[#111] rounded-xl shadow-sm p-6 text-center text-gray-500">
        No hay funciones programadas
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {schedules.map((schedule, index) => (
        <CapacityRow
          key={`${schedule.name}-${schedule.date}-${index}`}
          schedule={schedule}
          isExpanded={expandedIndex === index}
          onToggle={onToggle ? () => onToggle(index) : undefined}
          zones={schedule.eventId && zonesByEvent ? zonesByEvent[schedule.eventId] : undefined}
        />
      ))}
    </div>
  );
}
