'use server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

export async function getOrders(filters?: { event_id?: string; status?: string }) {
  try {
    let endpoint = `${SUPABASE_URL}/rest/v1/tickets?order=created_at.desc&limit=50`;
    if (filters?.event_id) endpoint += `&event_id=eq.${filters.event_id}`;
    if (filters?.status) endpoint += `&status=eq.${filters.status}`;
    const res = await fetch(endpoint, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Error al cargar órdenes' };
  }
}

export async function getOrderStats() {
  try {
    const [ticketsRes, zonesRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/tickets?select=id`, { headers, cache: 'no-store' }),
      fetch(`${SUPABASE_URL}/rest/v1/ticket_zones`, { headers, cache: 'no-store' }),
    ]);
    if (!ticketsRes.ok || !zonesRes.ok) throw new Error('Error fetching stats');
    const tickets = await ticketsRes.json();
    const zones = await zonesRes.json();
    const totalRevenue = zones.reduce((sum: number, z: any) => sum + (z.sold * z.price), 0);
    const totalCount = tickets.length;
    const aov = totalCount > 0 ? totalRevenue / totalCount : 0;
    return { success: true, data: { totalRevenue, totalCount, aov } };
  } catch (error) {
    return { success: false, error: 'Error al cargar estadísticas' };
  }
}
