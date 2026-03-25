'use server';

import { logAction } from './audit.actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU5MzkzNCwiZXhwIjoyMDg5MTY5OTM0fQ.-1ABMJP5sYUyW1MDg2W7T8ZE3ipe5x_Lvmec9UdZkO8';

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

export async function getTickets(filters?: { event_id?: string; status?: string }) {
  try {
    let endpoint = `${SUPABASE_URL}/rest/v1/tickets?order=created_at.desc`;
    if (filters?.event_id) endpoint += `&event_id=eq.${filters.event_id}`;
    if (filters?.status) endpoint += `&status=eq.${filters.status}`;
    const res = await fetch(endpoint, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Error al cargar boletos' };
  }
}

export async function validateTicket(ticketId: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tickets?id=eq.${ticketId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'used', updated_at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('update', 'ticket', ticketId, 'Boleto validado (check-in)');
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al validar boleto' };
  }
}

export async function getTicketStats() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tickets?select=id,status`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const tickets = await res.json();
    const byStatus = tickets.reduce((acc: Record<string, number>, t: any) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    return { success: true, data: { total: tickets.length, byStatus } };
  } catch (error) {
    return { success: false, error: 'Error al cargar estadísticas de boletos' };
  }
}
