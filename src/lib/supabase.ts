const SUPABASE_URL = 'https://udjwabtyhjcrpyuffavz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTM5MzQsImV4cCI6MjA4OTE2OTkzNH0.5RxuCjEPKY2eLmSG8iwMVKJnczcBRNhQH1QADm68UW4';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// Types
export interface DulosEvent {
  id: string;
  name: string;
  venue: string;
  city: string;
  dates: string;
  status: string;
  image_url: string;
  buy_url: string;
}

export interface TicketZone {
  event_id: string;
  zone_name: string;
  price: number;
  original_price: number;
  available: number;
  sold: number;
}

export interface Order {
  order_number: string;
  customer_name: string;
  customer_email: string;
  event_id: string;
  zone_name: string;
  quantity: number;
  total_price: number;
  payment_status: string;
  purchased_at: string;
}

export interface Escalation {
  client_id: string;
  reason: string;
  event_mentioned: string;
  situation: string;
  resolved: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  total_spent: number;
  total_orders: number;
  created_at: string;
}

export interface Schedule {
  id: string;
  event_id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_capacity: number;
  sold_capacity: number;
  reserved_capacity: number;
  status: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  order_id: string;
  ticket_number: string;
  event_id: string;
  zone_name: string;
  status: string;
  customer_name: string;
  customer_email: string;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  used_count: number;
  max_uses?: number;
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
  event_id?: string;
  created_at: string;
}

export interface Checkin {
  id: string;
  ticket_id: string | null;
  ticket_number: string;
  customer_name: string;
  event_name: string;
  venue: string;
  operator_name: string;
  status: string;
  scanned_at: string;
}

export interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  created_at: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalTickets: number;
  totalEvents: number;
  occupancyRate: number;
}

async function supabaseFetch<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, { headers });
  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchEvents(): Promise<DulosEvent[]> {
  try {
    return await supabaseFetch<DulosEvent[]>('dulos_events?status=eq.active');
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
}

export async function fetchZones(eventId?: string): Promise<TicketZone[]> {
  try {
    const endpoint = eventId
      ? `dulos_ticket_zones?event_id=eq.${eventId}`
      : 'dulos_ticket_zones';
    return await supabaseFetch<TicketZone[]>(endpoint);
  } catch (error) {
    console.error('Error fetching zones:', error);
    throw error;
  }
}

export async function fetchOrders(): Promise<Order[]> {
  try {
    // dulos_orders is empty, so we fetch from dulos_tickets and map to Order[]
    const tickets = await supabaseFetch<Ticket[]>('dulos_tickets?order=created_at.desc&limit=50');
    return tickets.map((ticket) => ({
      order_number: ticket.order_id,
      customer_name: ticket.customer_name,
      customer_email: ticket.customer_email,
      event_id: ticket.event_id,
      zone_name: ticket.zone_name,
      quantity: 1,
      total_price: 0, // Not available from tickets
      payment_status: ticket.status,
      purchased_at: ticket.created_at,
    }));
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
}

export async function fetchEscalations(): Promise<Escalation[]> {
  try {
    return await supabaseFetch<Escalation[]>('dulos_escalations?resolved=eq.false');
  } catch (error) {
    console.error('Error fetching escalations:', error);
    throw error;
  }
}

export async function fetchCustomers(): Promise<Customer[]> {
  try {
    return await supabaseFetch<Customer[]>('dulos_customers?order=total_spent.desc');
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
}

export async function fetchSchedules(eventId?: string): Promise<Schedule[]> {
  try {
    const endpoint = eventId
      ? `dulos_schedules?event_id=eq.${eventId}`
      : 'dulos_schedules';
    return await supabaseFetch<Schedule[]>(endpoint);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    throw error;
  }
}

export async function fetchTickets(): Promise<Ticket[]> {
  try {
    return await supabaseFetch<Ticket[]>('dulos_tickets?order=created_at.desc');
  } catch (error) {
    console.error('Error fetching tickets:', error);
    throw error;
  }
}

export async function fetchCoupons(): Promise<Coupon[]> {
  try {
    return await supabaseFetch<Coupon[]>('dulos_coupons?is_active=eq.true&order=created_at.desc');
  } catch (error) {
    console.error('Error fetching coupons:', error);
    throw error;
  }
}

export async function fetchCheckins(): Promise<Checkin[]> {
  try {
    return await supabaseFetch<Checkin[]>('dulos_checkins?order=scanned_at.desc&limit=20');
  } catch (error) {
    console.error('Error fetching checkins:', error);
    throw error;
  }
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    return await supabaseFetch<AuditLog[]>('dulos_audit_logs?order=created_at.desc&limit=20');
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
}

export async function fetchTeam(): Promise<TeamMember[]> {
  try {
    return await supabaseFetch<TeamMember[]>('dulos_team?order=role');
  } catch (error) {
    console.error('Error fetching team:', error);
    throw error;
  }
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const [events, tickets, zones] = await Promise.all([
      fetchEvents(),
      supabaseFetch<Ticket[]>('dulos_tickets?select=id'),
      fetchZones(),
    ]);

    // Count total tickets from dulos_tickets
    const totalTickets = tickets.length;

    // Calculate revenue from zones (sold * price)
    const totalRevenue = zones.reduce((sum, zone) => sum + (zone.sold * zone.price), 0);
    const totalEvents = events.length;

    const totalSold = zones.reduce((sum, zone) => sum + zone.sold, 0);
    const totalAvailable = zones.reduce((sum, zone) => sum + zone.available + zone.sold, 0);
    const occupancyRate = totalAvailable > 0 ? (totalSold / totalAvailable) * 100 : 0;

    return {
      totalRevenue,
      totalTickets,
      totalEvents,
      occupancyRate,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}
