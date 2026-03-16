'use client';

import React, { useState } from 'react';
import FinanceScorecard from '../components/FinanceScorecard';
import CapacityBars from '../components/CapacityBars';
import SalesTrend from '../components/SalesTrend';

type TabKey = 'ingresos' | 'capacidad' | 'tendencias';

const mockScorecardData = {
  revenue: 2847650,
  revenuePrevious: 2156800,
  aov: 1245,
  aovPrevious: 1180,
  completedOrders: 2287,
  completedOrdersPrevious: 1828,
  occupancyPercent: 78.5,
  occupancyPercentPrevious: 65.2,
};

const mockSchedules = [
  {
    name: 'Café Tacvba - 30 Aniversario',
    date: '2024-03-22T20:00:00',
    capacity: 15000,
    sold: 14250,
    percentage: 95,
  },
  {
    name: 'Luis Miguel Tour 2024',
    date: '2024-03-23T21:00:00',
    capacity: 55000,
    sold: 52800,
    percentage: 96,
  },
  {
    name: 'Feria del Libro CDMX',
    date: '2024-03-24T10:00:00',
    capacity: 8000,
    sold: 5600,
    percentage: 70,
  },
  {
    name: 'Molotov - Unplugged',
    date: '2024-03-25T20:30:00',
    capacity: 3500,
    sold: 2975,
    percentage: 85,
  },
  {
    name: 'Ballet Folklórico Nacional',
    date: '2024-03-26T19:00:00',
    capacity: 2200,
    sold: 880,
    percentage: 40,
  },
  {
    name: 'Cirque du Soleil - Kooza',
    date: '2024-03-27T18:00:00',
    capacity: 2500,
    sold: 625,
    percentage: 25,
  },
  {
    name: 'Panteón Rococó - Concierto Benéfico',
    date: '2024-03-28T19:30:00',
    capacity: 12000,
    sold: 10800,
    percentage: 90,
  },
  {
    name: 'Festival Vive Latino (Día 1)',
    date: '2024-03-29T14:00:00',
    capacity: 85000,
    sold: 76500,
    percentage: 90,
  },
];

const mockDailyData = [
  { date: '2024-03-09', amount: 385400 },
  { date: '2024-03-10', amount: 412750 },
  { date: '2024-03-11', amount: 298600 },
  { date: '2024-03-12', amount: 456200 },
  { date: '2024-03-13', amount: 521800 },
  { date: '2024-03-14', amount: 389500 },
  { date: '2024-03-15', amount: 483400 },
];

const tabs: { key: TabKey; label: string }[] = [
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'capacidad', label: 'Capacidad' },
  { key: 'tendencias', label: 'Tendencias' },
];

const exportCSV = () => {
  const rows = [
    ['Métrica', 'Valor Actual', 'Valor Anterior', 'Cambio %'],
    ['Ingresos', '2847650', '2156800', '+32%'],
    ['AOV', '1245', '1180', '+5.5%'],
    ['Órdenes Completadas', '2287', '1828', '+25%'],
    ['Ocupación %', '78.5', '65.2', '+13.3%'],
    ['Boletos VIP', '1245800', '-', '+23%'],
    ['Boletos General', '1156350', '-', '+18%'],
    ['Servicios Adicionales', '445500', '-', '-5%'],
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'metricas_financieras.csv';
  a.click();
  URL.revokeObjectURL(url);
};

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ingresos');

  return (
    <div className="min-h-screen bg-[#f8f6f6] p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel Financiero</h1>
            <p className="text-gray-500 mt-1">
              Métricas de ingresos, capacidad y tendencias de venta
            </p>
          </div>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-[#E63946] text-white rounded-lg font-medium hover:bg-[#c5303c] transition-colors"
          >
            Exportar CSV
          </button>
        </header>

        <nav className="mb-6">
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-[#E63946] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <main>
          {activeTab === 'ingresos' && (
            <div className="space-y-6">
              <FinanceScorecard data={mockScorecardData} currency="MXN" />

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Resumen de Ingresos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-[#f8f6f6] rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Boletos VIP</p>
                    <p className="text-2xl font-bold text-gray-900">$1,245,800</p>
                    <p className="text-xs text-green-600 mt-1">▲ 23% vs mes anterior</p>
                  </div>
                  <div className="p-4 bg-[#f8f6f6] rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Boletos General</p>
                    <p className="text-2xl font-bold text-gray-900">$1,156,350</p>
                    <p className="text-xs text-green-600 mt-1">▲ 18% vs mes anterior</p>
                  </div>
                  <div className="p-4 bg-[#f8f6f6] rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Servicios Adicionales</p>
                    <p className="text-2xl font-bold text-gray-900">$445,500</p>
                    <p className="text-xs text-red-600 mt-1">▼ 5% vs mes anterior</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'capacidad' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Ocupación por Función
                  </h2>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-[#E63946]"></span>
                      Crítico (&gt;80%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      Alto (50-80%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      Normal (&lt;50%)
                    </span>
                  </div>
                </div>
              </div>

              <CapacityBars schedules={mockSchedules} />

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Estadísticas de Capacidad
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-3xl font-bold text-[#E63946]">5</p>
                    <p className="text-sm text-gray-600">Eventos Críticos</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-600">1</p>
                    <p className="text-sm text-gray-600">Ocupación Alta</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">2</p>
                    <p className="text-sm text-gray-600">Ocupación Normal</p>
                  </div>
                  <div className="text-center p-4 bg-[#f8f6f6] rounded-lg">
                    <p className="text-3xl font-bold text-gray-900">183,430</p>
                    <p className="text-sm text-gray-600">Capacidad Total</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tendencias' && (
            <div className="space-y-6">
              <SalesTrend dailyData={mockDailyData} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Mejores Días de Venta
                  </h3>
                  <div className="space-y-3">
                    {[...mockDailyData]
                      .sort((a, b) => b.amount - a.amount)
                      .slice(0, 3)
                      .map((day, index) => (
                        <div
                          key={day.date}
                          className="flex justify-between items-center p-3 bg-[#f8f6f6] rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                index === 0
                                  ? 'bg-[#E63946]'
                                  : index === 1
                                  ? 'bg-gray-400'
                                  : 'bg-amber-600'
                              }`}
                            >
                              {index + 1}
                            </span>
                            <span className="font-medium text-gray-900">
                              {new Intl.DateTimeFormat('es-MX', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'short',
                              }).format(new Date(day.date))}
                            </span>
                          </div>
                          <span className="font-bold text-gray-900">
                            {new Intl.NumberFormat('es-MX', {
                              style: 'currency',
                              currency: 'MXN',
                              minimumFractionDigits: 0,
                            }).format(day.amount)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Proyección Semanal
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm text-gray-500">Meta semanal</p>
                        <p className="text-2xl font-bold text-gray-900">$3,000,000</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Alcanzado</p>
                        <p className="text-2xl font-bold text-[#E63946]">$2,947,650</p>
                      </div>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#E63946] rounded-full transition-all duration-500"
                        style={{ width: '98.3%' }}
                      />
                    </div>
                    <p className="text-center text-sm text-gray-600">
                      <span className="font-semibold text-[#E63946]">98.3%</span> de la
                      meta alcanzada
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
