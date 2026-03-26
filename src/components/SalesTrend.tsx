'use client';

import React from 'react';

interface DailyData {
  date: string;
  amount: number;
}

interface SalesTrendProps {
  dailyData: DailyData[];
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
}

function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
  }).format(date);
}

export default function SalesTrend({ dailyData }: SalesTrendProps) {
  if (!dailyData || dailyData.length === 0) {
    return (
      <div className="bg-[#111] rounded-xl shadow-sm p-6 text-center text-gray-500">
        No hay datos de ventas disponibles
      </div>
    );
  }

  const maxAmount = Math.max(...dailyData.map((d) => d.amount));
  const minAmount = Math.min(...dailyData.map((d) => d.amount));
  const range = maxAmount - minAmount || 1;

  const chartHeight = 200;
  const chartWidth = 100;
  const padding = 10;

  const points = dailyData.map((d, i) => {
    const x = (i / (dailyData.length - 1)) * (chartWidth - padding * 2) + padding;
    const y =
      chartHeight -
      padding -
      ((d.amount - minAmount) / range) * (chartHeight - padding * 2);
    return { x, y, data: d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const areaPath = `
    ${linePath}
    L ${points[points.length - 1].x} ${chartHeight - padding}
    L ${points[0].x} ${chartHeight - padding}
    Z
  `;

  const yAxisValues = [
    minAmount,
    minAmount + range * 0.25,
    minAmount + range * 0.5,
    minAmount + range * 0.75,
    maxAmount,
  ].reverse();

  return (
    <div className="bg-[#111] rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Ventas Acumuladas - Últimos 7 días
      </h3>

      <div className="flex gap-4">
        <div className="flex flex-col justify-between text-xs text-gray-500 py-2 w-16 text-right">
          {yAxisValues.map((value, i) => (
            <span key={i}>{formatCurrency(value)}</span>
          ))}
        </div>

        <div className="flex-1 relative">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-52"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(230,57,70,0.2)" />
                <stop offset="100%" stopColor="rgba(230,57,70,0.02)" />
              </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = padding + (chartHeight - padding * 2) * ratio;
              return (
                <line
                  key={i}
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke="#333"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
              );
            })}

            <path d={areaPath} fill="url(#areaGradient)" />

            <path
              d={linePath}
              fill="none"
              stroke="#EF4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="4" fill="#EF4444" />
                <circle cx={p.x} cy={p.y} r="2" fill="white" />
              </g>
            ))}
          </svg>

          <div className="flex justify-between mt-2 text-xs text-gray-500 px-2">
            {dailyData.map((d, i) => (
              <span key={i} className="text-center">
                {formatShortDate(d.date)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-500">Total acumulado</p>
          <p className="text-2xl font-bold text-white">
            {new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
              minimumFractionDigits: 0,
            }).format(dailyData.reduce((sum, d) => sum + d.amount, 0))}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Promedio diario</p>
          <p className="text-xl font-semibold text-[#EF4444]">
            {new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
              minimumFractionDigits: 0,
            }).format(
              dailyData.reduce((sum, d) => sum + d.amount, 0) / dailyData.length
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
