'use client';

import React from 'react';

type FeedItemType = 'order' | 'checkin' | 'alert' | 'coupon';

interface FeedItem {
  type: FeedItemType;
  message: string;
  timestamp: Date | string;
}

interface RecentFeedProps {
  items: FeedItem[];
}

function getDotColor(type: FeedItemType): string {
  switch (type) {
    case 'order':
      return 'bg-green-500';
    case 'checkin':
      return 'bg-blue-500';
    case 'alert':
      return 'bg-red-500/100';
    case 'coupon':
      return 'bg-purple-500';
    default:
      return 'bg-[#0d0d0d]0';
  }
}

function getTypeLabel(type: FeedItemType): string {
  switch (type) {
    case 'order':
      return 'Venta';
    case 'checkin':
      return 'Check-in';
    case 'alert':
      return 'Alerta';
    case 'coupon':
      return 'Cupón';
    default:
      return 'Evento';
  }
}

function formatRelativeTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'hace un momento';
  }
  if (diffMin < 60) {
    return `hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
  }
  if (diffHour < 24) {
    return `hace ${diffHour} ${diffHour === 1 ? 'hora' : 'horas'}`;
  }
  return `hace ${diffDay} ${diffDay === 1 ? 'día' : 'días'}`;
}

function FeedItemRow({ item }: { item: FeedItem }) {
  return (
    <div className="flex items-start gap-3 py-3">
      {/* Color dot */}
      <div className="flex-shrink-0 mt-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${getDotColor(item.type)}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            item.type === 'order' ? 'bg-green-100 text-green-700' :
            item.type === 'checkin' ? 'bg-blue-100 text-blue-700' :
            item.type === 'alert' ? 'bg-red-100 text-red-700' :
            'bg-purple-100 text-purple-700'
          }`}>
            {getTypeLabel(item.type)}
          </span>
        </div>
        <p className="text-sm text-white">{item.message}</p>
      </div>

      {/* Timestamp */}
      <div className="flex-shrink-0">
        <span className="text-xs text-gray-400">
          {formatRelativeTime(item.timestamp)}
        </span>
      </div>
    </div>
  );
}

export default function RecentFeed({ items }: RecentFeedProps) {
  const displayItems = items.slice(0, 10);

  if (!items || items.length === 0) {
    return (
      <div className="bg-[#111] rounded-xl shadow-sm border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Actividad Reciente
        </h2>
        <p className="text-gray-500 text-center py-8">
          No hay actividad reciente para mostrar.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#111] rounded-xl shadow-sm border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          Actividad Reciente
        </h2>
        <button className="text-sm text-[#EF4444] hover:underline font-medium">
          Ver todo
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {displayItems.map((item, index) => (
          <FeedItemRow key={index} item={item} />
        ))}
      </div>
    </div>
  );
}
