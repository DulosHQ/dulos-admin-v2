const SUPABASE_URL = 'https://udjwabtyhjcrpyuffavz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTM5MzQsImV4cCI6MjA4OTE2OTkzNH0.5RxuCjEPKY2eLmSG8iwMVKJnczcBRNhQH1QADm68UW4';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// Types
export interface DulosEvent {
  id: string;           // e.g. "mijares"
  name: string;         // e.g. "Mijares Sinfónico"
  start_date: string;   // ISO datetime
  end_date: string;     // ISO datetime
  image_url: string;
  status: string;       // "active"
  slug: string;
  description: string;
  price_from: number;   // e.g. 1249
  original_price: number;
  featured: boolean;
  sort_order: number;
  venue_id: string;     // FK to dulos_venues
  category: string;     // "concierto", "teatro"
  event_type: string;   // "single"
  created_at: string;
  updated_at: string;
  // Optional SEO fields
  seo_title?: string;
  seo_description?: string;
  long_description?: string;
  quote?: string;
  show_remaining?: boolean;
  seatmap_event_key?: string;
}

export interface Venue {
  id: string;
  name: string;        // "Teatro Morelos"
  slug: string;
  address: string;
  city: string;         // "Toluca"
  state: string;        // "Puebla"
  country: string;
  latitude: number;
  longitude: number;
  maps_url: string;
  timezone: string;     // "America/Mexico_City"
  capacity: number;     // 500
  image_url?: string;
  created_at: string;
}

export interface SalesSummary {
  event_id: string;
  event_name: string;
  venue_name: string;
  total_orders: number;
  total_tickets_sold: number;
  total_revenue: number;
  checked_in: number;
  refunded: number;
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
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_id?: string;
  event_id: string;
  zone_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  payment_status: string;
  stripe_payment_id?: string;
  event_date?: string;
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
  last_name: string;
  email: string;
  phone?: string;
  total_spent: number;
  total_orders: number;
  total_purchases: number;
  first_purchase_at?: string;
  last_purchase_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
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
  ticket_token: string;
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
  permissions_count?: number;
  is_active: boolean;
  last_login?: string;
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

// Venue cache and helpers
let venueCache: Map<string, Venue> | null = null;

export async function fetchVenues(): Promise<Venue[]> {
  try {
    return await supabaseFetch<Venue[]>('dulos_venues');
  } catch (error) {
    console.error('Error fetching venues:', error);
    throw error;
  }
}

export async function getVenueMap(): Promise<Map<string, Venue>> {
  if (!venueCache) {
    const venues = await fetchVenues();
    venueCache = new Map(venues.map(v => [v.id, v]));
  }
  return venueCache;
}

export function getVenueName(venueId: string, venueMap: Map<string, Venue>): string {
  return venueMap.get(venueId)?.name || venueId;
}

export function getVenueCity(venueId: string, venueMap: Map<string, Venue>): string {
  return venueMap.get(venueId)?.city || '';
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
    return await supabaseFetch<Order[]>('dulos_orders?order=purchased_at.desc&limit=50');
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
    return await supabaseFetch<Customer[]>('customers?order=total_spent.desc');
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

export async function fetchAllEvents(): Promise<DulosEvent[]> {
  try {
    return await supabaseFetch<DulosEvent[]>('dulos_events?order=start_date.desc');
  } catch (error) {
    console.error('Error fetching all events:', error);
    throw error;
  }
}

export async function fetchAllCoupons(): Promise<Coupon[]> {
  try {
    return await supabaseFetch<Coupon[]>('dulos_coupons?order=created_at.desc');
  } catch (error) {
    console.error('Error fetching all coupons:', error);
    throw error;
  }
}

export async function fetchSalesSummary(): Promise<SalesSummary[]> {
  try {
    return await supabaseFetch<SalesSummary[]>('v_sales_summary');
  } catch (error) {
    console.error('Error fetching sales summary:', error);
    throw error;
  }
}

// Dashboard tabs fetch functions
export async function fetchDashboardTab(tabName: string): Promise<{ headers: string[]; rows: any[]; totalRows: number }> {
  try {
    const data = await supabaseFetch<any[]>(`dulos_dashboard_tabs?tab_name=eq.${tabName}&order=id.asc`);

    if (data.length === 0) {
      return { headers: [], rows: [], totalRows: 0 };
    }

    // Aggregate all rows across multiple records (for pagination)
    let allHeaders: string[] = [];
    let allRows: any[] = [];
    let totalRows = 0;

    data.forEach(record => {
      if (record.headers && allHeaders.length === 0) {
        allHeaders = record.headers;
      }
      if (record.row_data && Array.isArray(record.row_data)) {
        allRows = allRows.concat(record.row_data);
      }
      if (record.total_rows) {
        totalRows = Math.max(totalRows, record.total_rows);
      }
    });

    return {
      headers: allHeaders,
      rows: allRows,
      totalRows: totalRows || allRows.length
    };
  } catch (error) {
    console.error(`Error fetching dashboard tab ${tabName}:`, error);
    throw error;
  }
}

// Convenience functions for specific tabs
export async function fetchProyectos() {
  return fetchDashboardTab('Proyectos');
}

export async function fetchPedidos() {
  return fetchDashboardTab('Pedidos');
}

export async function fetchBoletos() {
  return fetchDashboardTab('Boletos');
}

export async function fetchReservas() {
  return fetchDashboardTab('Reservas');
}

export async function fetchComisiones() {
  return fetchDashboardTab('Comisiones');
}

export async function fetchAllOrders(): Promise<Order[]> {
  try {
    return await supabaseFetch<Order[]>('dulos_orders?order=purchased_at.desc');
  } catch (error) {
    console.error('Error fetching all orders:', error);
    throw error;
  }
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const [events, salesSummary, zones] = await Promise.all([
      fetchEvents(),
      fetchSalesSummary(),
      fetchZones(),
    ]);

    // Calculate revenue and tickets from sales summary (REAL data)
    const totalRevenue = salesSummary.reduce((sum, s) => sum + s.total_revenue, 0);
    const totalTickets = salesSummary.reduce((sum, s) => sum + s.total_tickets_sold, 0);
    const totalEvents = events.length;

    // Calculate occupancy rate from zones
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

// New functions for enhanced features

export async function fetchTicketsByEvent(eventId: string): Promise<Ticket[]> {
  try {
    return await supabaseFetch<Ticket[]>(`dulos_tickets?event_id=eq.${eventId}&order=created_at.desc`);
  } catch (error) {
    console.error('Error fetching tickets by event:', error);
    throw error;
  }
}

export async function fetchCustomersFromTickets(): Promise<Customer[]> {
  try {
    return await supabaseFetch<Customer[]>('customers?order=total_spent.desc');
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
}

export async function fetchTransactionHistory(): Promise<Ticket[]> {
  try {
    return await supabaseFetch<Ticket[]>('dulos_tickets?order=created_at.desc&limit=100');
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

export async function fetchNotificationLogs(): Promise<AuditLog[]> {
  try {
    // Filter audit logs for notification-related actions
    return await supabaseFetch<AuditLog[]>('dulos_audit_logs?action=ilike.*notification*&order=created_at.desc&limit=50');
  } catch (error) {
    console.error('Error fetching notification logs:', error);
    throw error;
  }
}

export async function searchCustomerByNameOrEmail(query: string): Promise<Customer[]> {
  try {
    return await supabaseFetch<Customer[]>(`customers?or=(name.ilike.*${query}*,email.ilike.*${query}*)&order=total_spent.desc&limit=20`);
  } catch (error) {
    console.error('Error searching customers:', error);
    throw error;
  }
}

export async function fetchRevenueByEvent(): Promise<{ event_id: string; event_name: string; revenue: number; image_url?: string }[]> {
  try {
    const [events, zones] = await Promise.all([
      fetchAllEvents(),
      fetchZones(),
    ]);

    const eventMap = new Map(events.map(e => [e.id, e]));
    const revenueByEvent = new Map<string, number>();

    zones.forEach(zone => {
      const current = revenueByEvent.get(zone.event_id) || 0;
      revenueByEvent.set(zone.event_id, current + (zone.sold * zone.price));
    });

    return Array.from(revenueByEvent.entries())
      .map(([eventId, revenue]) => {
        const event = eventMap.get(eventId);
        return {
          event_id: eventId,
          event_name: event?.name || eventId,
          revenue,
          image_url: event?.image_url,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  } catch (error) {
    console.error('Error fetching revenue by event:', error);
    throw error;
  }
}

export async function fetchAuditLogsByAction(actionFilter?: string): Promise<AuditLog[]> {
  try {
    const endpoint = actionFilter 
      ? `dulos_audit_logs?action=ilike.*${actionFilter}*&order=created_at.desc&limit=100`
      : 'dulos_audit_logs?order=created_at.desc&limit=100';
    return await supabaseFetch<AuditLog[]>(endpoint);
  } catch (error) {
    console.error('Error fetching filtered audit logs:', error);
    throw error;
  }
}
