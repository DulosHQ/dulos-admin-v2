import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Test coupons management — create/delete test coupons for stress testing.
 * Auth: same secret as meta-proxy.
 */

const PROXY_SECRET = process.env.CRON_SECRET || process.env.META_PROXY_SECRET || 'dulos-meta-proxy-2026';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== PROXY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, coupon, prefix } = await request.json();

  const supabase = getSupabase();

  if (action === 'create') {
    const { data, error } = await supabase.from('coupons').insert(coupon).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ coupon: data });
  }

  if (action === 'cleanup') {
    const { data: existing } = await supabase.from('coupons').select('id').like('code', `${prefix || 'STRESS_TEST_'}%`);
    let deleted = 0;
    for (const c of (existing || [])) {
      await supabase.from('coupons').delete().eq('id', c.id);
      deleted++;
    }
    return NextResponse.json({ deleted });
  }

  if (action === 'list') {
    const { data } = await supabase.from('coupons').select('*').like('code', `${prefix || 'STRESS_TEST_'}%`);
    return NextResponse.json({ coupons: data });
  }

  if (action === 'query') {
    // Generic read query for test verification
    const { table, filter, select } = coupon || {};
    if (!table) return NextResponse.json({ error: 'table required' }, { status: 400 });
    let q = supabase.from(table).select(select || '*');
    if (filter) {
      for (const [key, val] of Object.entries(filter)) {
        q = q.eq(key, val);
      }
    }
    const { data, error } = await q.limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
