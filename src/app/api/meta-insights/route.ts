import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const AD_ACCOUNT = 'act_1372745737889888';

export async function GET(request: NextRequest) {
  try {
    // Auth check: either admin_key cookie or key query param
    const cookieStore = await cookies();
    const adminKeyCookie = cookieStore.get('admin_key')?.value;
    const keyParam = request.nextUrl.searchParams.get('key');

    if (!adminKeyCookie && (!keyParam || keyParam !== ADMIN_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!META_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'META_ACCESS_TOKEN not configured' }, { status: 500 });
    }

    // Parse query parameters
    const level = request.nextUrl.searchParams.get('level') || 'campaign';
    const datePreset = request.nextUrl.searchParams.get('date_preset') || 'last_30d';
    const filtering = request.nextUrl.searchParams.get('filtering');
    
    // Build Meta API fields based on level
    let fields = [
      'spend', 'impressions', 'reach', 'clicks', 'actions', 'cost_per_action_type', 
      'cpc', 'cpm', 'ctr'
    ];
    
    if (level === 'campaign' || level === 'adset') {
      fields.push('campaign_id', 'campaign_name');
    }
    if (level === 'adset' || level === 'ad') {
      fields.push('adset_id', 'adset_name');
    }
    if (level === 'ad') {
      fields.push('ad_id', 'ad_name');
    }

    // Build Meta Graph API URL
    const baseUrl = `https://graph.facebook.com/v21.0/${AD_ACCOUNT}/insights`;
    const params = new URLSearchParams({
      access_token: META_ACCESS_TOKEN,
      level,
      date_preset: datePreset,
      fields: fields.join(','),
      limit: '100'
    });

    if (filtering) {
      params.set('filtering', filtering);
    }

    const metaApiUrl = `${baseUrl}?${params.toString()}`;

    // Fetch from Meta API
    const response = await fetch(metaApiUrl, {
      cache: 'no-store', // Always fresh data
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Meta API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Meta API error: ${response.status}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform and clean the data for consistent structure
    const transformedData = {
      data: data.data?.map((item: any) => ({
        // IDs and names
        campaign_id: item.campaign_id,
        campaign_name: item.campaign_name,
        adset_id: item.adset_id,
        adset_name: item.adset_name,
        ad_id: item.ad_id,
        ad_name: item.ad_name,
        
        // Metrics (parse as numbers)
        spend: parseFloat(item.spend || '0'),
        impressions: parseInt(item.impressions || '0'),
        reach: parseInt(item.reach || '0'),
        clicks: parseInt(item.clicks || '0'),
        cpc: parseFloat(item.cpc || '0'),
        cpm: parseFloat(item.cpm || '0'),
        ctr: parseFloat(item.ctr || '0'),
        
        // Actions (extract purchases)
        purchases: extractPurchases(item.actions),
        
        // Cost per action
        cost_per_purchase: extractCostPerAction(item.cost_per_action_type, 'offsite_conversion.fb_pixel_purchase'),
        
        // Raw actions and cost_per_action_type for debugging
        actions: item.actions,
        cost_per_action_type: item.cost_per_action_type,
      })) || [],
      
      paging: data.paging,
    };

    return NextResponse.json(transformedData);

  } catch (error: any) {
    console.error('Meta insights API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// Helper function to extract purchases from actions array
function extractPurchases(actions: any[]): number {
  if (!Array.isArray(actions)) return 0;
  
  const purchaseAction = actions.find(
    action => action.action_type === 'offsite_conversion.fb_pixel_purchase'
  );
  
  return parseInt(purchaseAction?.value || '0');
}

// Helper function to extract cost per action for specific action type
function extractCostPerAction(costPerActionType: any[], actionType: string): number {
  if (!Array.isArray(costPerActionType)) return 0;
  
  const costAction = costPerActionType.find(
    cost => cost.action_type === actionType
  );
  
  return parseFloat(costAction?.value || '0');
}