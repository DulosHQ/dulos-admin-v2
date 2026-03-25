'use server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU5MzkzNCwiZXhwIjoyMDg5MTY5OTM0fQ.-1ABMJP5sYUyW1MDg2W7T8ZE3ipe5x_Lvmec9UdZkO8';

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

export async function getAuditLog(filters?: { action?: string }) {
  try {
    let endpoint = `${SUPABASE_URL}/rest/v1/audit_logs?order=created_at.desc&limit=100`;
    if (filters?.action) {
      endpoint += `&action=ilike.*${filters.action}*`;
    }
    const res = await fetch(endpoint, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Error al cargar el log de auditoría' };
  }
}

export async function logAction(
  action: string,
  entity_type: string,
  entity_id: string,
  details?: string,
  user_email?: string
) {
  try {
    const body = {
      action,
      entity_type,
      entity_id,
      details: details || null,
      user_email: user_email || 'system',
      created_at: new Date().toISOString(),
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Audit log failed:', res.status);
      return { success: false, error: 'Error al registrar auditoría' };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error('Audit log error:', error);
    return { success: false, error: 'Error al registrar auditoría' };
  }
}
