'use client';

import React from 'react';

interface ScoreCardData {
  revenue: number;
  revenuePrevious: number;
  aov: number;
  aovPrevious: number;
  completedOrders: number;
  completedOrdersPrevious: number;
  occupancyPercent: number;
  occupancyPercentPrevious: number;
}

interface FinanceScorecardProps {
  data: ScoreCardData;
  currency?: string;
}

function formatCurrency(value: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX').format(value);
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

interface CardProps {
  title: string;
  value: string;
  change: number;
  isPercentage?: boolean;
  icon: React.ReactNode;
  iconBg: string;
}

function Card({ title, value, change, isPercentage = false, icon, iconBg }: CardProps) {
  const isPositive = change >= 0;

  return (
    <div className="metric-card">
      <p className="metric-card-title">{title}</p>
      <p className="metric-card-value">
        {value}
        {isPercentage && <span className="text-2xl">%</span>}
      </p>
      {change !== 0 ? (
        <p className="metric-card-subtitle">
          <span className={isPositive ? 'pct-positive' : 'pct-negative'}>
            {isPositive ? '+' : ''}{change.toFixed(1)}%
          </span>
          <span className="text-gray-400 ml-1">vs periodo anterior</span>
        </p>
      ) : (
        <p className="metric-card-subtitle text-gray-400">Datos actuales</p>
      )}
      <div className={`metric-card-icon ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}

export default function FinanceScorecard({
  data,
  currency = 'MXN',
}: FinanceScorecardProps) {
  const revenueChange = calculateChange(data.revenue, data.revenuePrevious);
  const aovChange = calculateChange(data.aov, data.aovPrevious);
  const ordersChange = calculateChange(
    data.completedOrders,
    data.completedOrdersPrevious
  );
  const occupancyChange = calculateChange(
    data.occupancyPercent,
    data.occupancyPercentPrevious
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <Card
        title="Revenue Total"
        value={formatCurrency(data.revenue, currency)}
        change={revenueChange}
        iconBg="bg-emerald-100"
        icon={
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <Card
        title="AOV (Ticket Promedio)"
        value={formatCurrency(data.aov, currency)}
        change={aovChange}
        iconBg="bg-blue-100"
        icon={
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
      />
      <Card
        title="Órdenes Completadas"
        value={formatNumber(data.completedOrders)}
        change={ordersChange}
        iconBg="bg-purple-100"
        icon={
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        }
      />
      <Card
        title="Ocupación"
        value={data.occupancyPercent.toFixed(1)}
        change={occupancyChange}
        isPercentage
        iconBg="bg-amber-100"
        icon={
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      />
    </div>
  );
}
