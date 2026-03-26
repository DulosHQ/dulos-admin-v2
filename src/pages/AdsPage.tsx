'use client';

import { useState, useEffect } from 'react';

interface AdInsight {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  purchases: number;
  cost_per_purchase: number;
}

interface MetaInsightsResponse {
  data: AdInsight[];
  paging?: any;
}

type DatePreset = 'last_7d' | 'last_30d' | 'maximum';
type ViewLevel = 'campaign' | 'adset';

export default function AdsPage() {
  const [insights, setInsights] = useState<AdInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('last_30d');
  const [viewLevel, setViewLevel] = useState<ViewLevel>('campaign');
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  // Get admin key from cookie
  const getAdminKey = () => {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      const adminKeyCookie = cookies.find(cookie => cookie.trim().startsWith('admin_key='));
      return adminKeyCookie?.split('=')[1];
    }
    return '';
  };

  const fetchInsights = async (level: ViewLevel, campaignId?: string | null) => {
    setLoading(true);
    setError(null);
    
    try {
      const adminKey = getAdminKey();
      let url = `/api/meta-insights?level=${level}&date_preset=${datePreset}&key=${adminKey}`;
      
      // If drilling down to adsets, filter by campaign
      if (level === 'adset' && campaignId) {
        const filtering = JSON.stringify([{
          field: 'campaign.id',
          operator: 'EQUAL',
          value: campaignId
        }]);
        url += `&filtering=${encodeURIComponent(filtering)}`;
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.detail || `Failed to fetch insights: ${response.status}`);
      }

      const data: MetaInsightsResponse = await response.json();
      setInsights(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Meta Ads data');
      console.error('Meta insights error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights(viewLevel, selectedCampaign);
  }, [datePreset, viewLevel, selectedCampaign]);

  // Calculate KPIs
  const totalSpend = insights.reduce((sum, item) => sum + item.spend, 0);
  const totalPurchases = insights.reduce((sum, item) => sum + item.purchases, 0);
  const totalImpressions = insights.reduce((sum, item) => sum + item.impressions, 0);
  const totalClicks = insights.reduce((sum, item) => sum + item.clicks, 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpr = totalPurchases > 0 ? totalSpend / totalPurchases : 0;

  const formatMXN = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-MX').format(num);
  };

  const formatPercentage = (num: number, decimals: number = 2) => {
    return `${num.toFixed(decimals)}%`;
  };

  const handleCampaignClick = (campaignId: string) => {
    if (viewLevel === 'campaign') {
      setSelectedCampaign(campaignId);
      setViewLevel('adset');
    }
  };

  const handleBackToCampaigns = () => {
    setViewLevel('campaign');
    setSelectedCampaign(null);
  };

  const getStatusBadge = (spend: number) => {
    // Simple heuristic: if spend > 0, assume active
    return spend > 0 ? (
      <span className="text-green-400">🟢 ACTIVA</span>
    ) : (
      <span className="text-gray-400">⏸️ PAUSADA</span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6">
        <div className="max-w-7xl mx-auto animate-pulse">
          <div className="h-8 bg-gray-800 rounded mb-6"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-gray-800 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {selectedCampaign && (
              <button 
                onClick={handleBackToCampaigns}
                className="text-[#EF4444] hover:text-red-300 transition-colors"
              >
                ← Volver a Campañas
              </button>
            )}
            <h1 className="text-2xl font-bold">
              {viewLevel === 'campaign' ? 'Panel de Meta Ads' : 'Ad Sets - Desglose de Campaña'}
            </h1>
          </div>

          {/* Date Filter */}
          <div className="flex gap-2">
            {(['last_7d', 'last_30d', 'maximum'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  datePreset === preset
                    ? 'bg-[#EF4444] text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {preset === 'last_7d' && '7d'}
                {preset === 'last_30d' && '30d'}
                {preset === 'maximum' && 'Max'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
            Error: {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm mb-2">Gasto Total</h3>
            <p className="text-2xl font-bold text-white">{formatMXN(totalSpend)}</p>
          </div>
          
          <div className="bg-[#111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm mb-2">Compras</h3>
            <p className="text-2xl font-bold text-green-400">{formatNumber(totalPurchases)}</p>
          </div>
          
          <div className="bg-[#111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm mb-2">CPR (Costo por Resultado)</h3>
            <p className="text-2xl font-bold text-blue-400">
              {totalPurchases > 0 ? formatMXN(cpr) : '—'}
            </p>
          </div>
          
          <div className="bg-[#111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm mb-2">ROAS</h3>
            <p className="text-2xl font-bold text-purple-400">—</p>
            <p className="text-xs text-gray-500">Requiere datos de revenue</p>
          </div>
        </div>

        {/* Campaign/AdSet Table */}
        <div className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900">
                  <th className="text-left py-4 px-6 font-medium text-gray-300">
                    {viewLevel === 'campaign' ? 'Campaña' : 'Ad Set'}
                  </th>
                  <th className="text-left py-4 px-6 font-medium text-gray-300">Estado</th>
                  <th className="text-right py-4 px-6 font-medium text-gray-300">Gasto</th>
                  <th className="text-right py-4 px-6 font-medium text-gray-300">Impresiones</th>
                  <th className="text-right py-4 px-6 font-medium text-gray-300">Clics</th>
                  <th className="text-right py-4 px-6 font-medium text-gray-300">CTR</th>
                  <th className="text-right py-4 px-6 font-medium text-gray-300">Compras</th>
                  <th className="text-right py-4 px-6 font-medium text-gray-300">CPR</th>
                </tr>
              </thead>
              <tbody>
                {insights
                  .sort((a, b) => b.spend - a.spend) // Sort by spend desc
                  .map((insight, index) => (
                    <tr 
                      key={index} 
                      className={`border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                        viewLevel === 'campaign' ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => viewLevel === 'campaign' && insight.campaign_id && handleCampaignClick(insight.campaign_id)}
                    >
                      <td className="py-4 px-6">
                        <div className="text-white font-medium">
                          {viewLevel === 'campaign' ? insight.campaign_name : insight.adset_name}
                        </div>
                        {viewLevel === 'adset' && insight.campaign_name && (
                          <div className="text-sm text-gray-400">{insight.campaign_name}</div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(insight.spend)}
                      </td>
                      <td className="py-4 px-6 text-right text-white">
                        {formatMXN(insight.spend)}
                      </td>
                      <td className="py-4 px-6 text-right text-gray-300">
                        {formatNumber(insight.impressions)}
                      </td>
                      <td className="py-4 px-6 text-right text-gray-300">
                        {formatNumber(insight.clicks)}
                      </td>
                      <td className="py-4 px-6 text-right text-gray-300">
                        {formatPercentage(insight.ctr)}
                      </td>
                      <td className="py-4 px-6 text-right text-green-400 font-medium">
                        {formatNumber(insight.purchases)}
                      </td>
                      <td className="py-4 px-6 text-right text-blue-400">
                        {insight.purchases > 0 ? formatMXN(insight.spend / insight.purchases) : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          
          {insights.length === 0 && !loading && (
            <div className="py-8 px-6 text-center text-gray-400">
              No se encontraron datos para el período seleccionado
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-[#111] border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400 mb-1">CTR Promedio</div>
            <div className="text-white font-medium">{formatPercentage(avgCTR)}</div>
          </div>
          
          <div className="bg-[#111] border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400 mb-1">Total Impresiones</div>
            <div className="text-white font-medium">{formatNumber(totalImpressions)}</div>
          </div>
          
          <div className="bg-[#111] border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400 mb-1">Total Clics</div>
            <div className="text-white font-medium">{formatNumber(totalClicks)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}