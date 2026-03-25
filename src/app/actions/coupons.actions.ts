'use server';

import { couponSchema, type CouponFormData } from '@/lib/validations/coupons.schema';
import { logAction } from './audit.actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://udjwabtyhjcrpyuffavz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU5MzkzNCwiZXhwIjoyMDg5MTY5OTM0fQ.-1ABMJP5sYUyW1MDg2W7T8ZE3ipe5x_Lvmec9UdZkO8';

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

export async function getCoupons() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/coupons?order=created_at.desc`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Error al cargar cupones' };
  }
}

export async function createCoupon(formData: CouponFormData) {
  const parsed = couponSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      fieldErrors[issue.path[0] as string] = issue.message;
    });
    return { success: false, error: 'Datos inválidos', fieldErrors };
  }

  try {
    const body: Record<string, unknown> = {
      code: parsed.data.code,
      type: parsed.data.type,
      discount_amount: parsed.data.type === 'fixed' ? (parsed.data.discount_amount || 0) : null,
      discount_percent: parsed.data.type === 'percentage' ? (parsed.data.discount_percent || 0) : null,
      event_id: parsed.data.event_id || null,
      zone_id: parsed.data.zone_id || null,
      max_uses: parsed.data.max_uses || null,
      max_uses_per_customer: parsed.data.max_uses_per_customer || null,
      min_tickets: parsed.data.min_tickets || null,
      valid_from: parsed.data.valid_from || null,
      valid_until: parsed.data.valid_until || null,
      is_active: true,
      is_public: parsed.data.is_public ?? false,
      uses_count: 0,
      created_at: new Date().toISOString(),
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/coupons`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error creating coupon: ${res.status} ${errText}`);
    }
    const data = await res.json();
    logAction('create', 'coupon', data[0]?.id || '', JSON.stringify({ code: parsed.data.code }));
    return { success: true, data: data[0] };
  } catch (error) {
    console.error('createCoupon error:', error);
    return { success: false, error: 'Error al crear el cupón' };
  }
}

export async function updateCoupon(id: string, formData: Partial<CouponFormData>) {
  try {
    // Map form fields to DB columns
    const body: Record<string, unknown> = {};
    if (formData.code !== undefined) body.code = formData.code;
    if (formData.type !== undefined) body.type = formData.type;
    if (formData.discount_amount !== undefined) body.discount_amount = formData.discount_amount;
    if (formData.discount_percent !== undefined) body.discount_percent = formData.discount_percent;
    if (formData.event_id !== undefined) body.event_id = formData.event_id || null;
    if (formData.max_uses !== undefined) body.max_uses = formData.max_uses;
    if (formData.valid_until !== undefined) body.valid_until = formData.valid_until;
    if (formData.is_public !== undefined) body.is_public = formData.is_public;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/coupons?id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('update', 'coupon', id, JSON.stringify(body));
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al actualizar el cupón' };
  }
}

export async function deleteCoupon(id: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/coupons?id=eq.${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    logAction('delete', 'coupon', id, 'Cupón eliminado');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al eliminar el cupón' };
  }
}
