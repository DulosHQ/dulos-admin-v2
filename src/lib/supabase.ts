const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// For server-side admin fetches, prefer service role for BOTH headers.
// Using anon in `apikey` with service-role bearer can cause inconsistent behavior
// depending on gateway/project config.
const REST_KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

const headers = {
  'apikey': REST_KEY,
  'Authorization': `Bearer ${REST_KEY}`,
  'Content-Type': 'application/json',
};

// Types
export interface DulosEvent {
  id: string;           // UUID
  name: string;
  start_date: string;
  end_date: string;
  image_url: string;
  status: string;
  slug: string;
  description: string;
  price_from: number;
  original_price: number;
  featured: boolean;
  sort_order: number;
  venue_id: string;
  category: string;
  event_type: string;
  created_at: string;
  updated_at: string;
  seo_title?: string;
  seo_description?: string;
  long_description?: string;
  quote?: string;
  show_remaining?: boolean;
  seatmap_event_key?: string;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code?: string;
  latitude: number;
  longitude: number;
  maps_url: string;
  timezone: string;
  capacity: number;
  image_url?: string;
  has_seatmap?: boolean;
  seatmap_key?: string;
  layout_svg_url?: string;
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
  zone_type?: string; // ga | numbered | hybrid
  price: number;
  original_price: number;
  available: number;
  sold: number;
  total_capacity?: number;
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
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer_url?: string;
  discount_amount?: number;
  subtotal?: number;
  net_amount?: number;
  stripe_fee?: number | null;
  coupon_code?: string | null;
  schedule_id?: string | null;
}

// Escalation table was dropped — interface kept for type compat
export interface Escalation {
  id: string;
  client_id: string;
  description: string;
  reason: string;
  event_mentioned: string;
  situation: string;
  status: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
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
  attendee_id?: string;
  is_buyer?: boolean;
  seat_label?: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  event_date?: string;
  used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: string;                    // DB: 'percentage' | 'fixed'
  discount_amount: number | null;  // for fixed discounts
  discount_percent: number | null; // for percentage discounts
  uses_count: number;
  max_uses?: number;
  max_uses_per_customer?: number;
  min_tickets?: number;
  is_active: boolean;
  is_public?: boolean;
  valid_from?: string;
  valid_until?: string;
  event_id?: string;
  zone_id?: string;
  zone_name?: string;
  created_at: string;
  updated_at?: string;
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
  role: 'super_admin' | 'operator' | 'analyst' | string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalTickets: number;
  totalEvents: number;
  occupancyRate: number;
}

// New view interfaces
export interface EventDashboard {
  event_id: string;
  event_name: string;
  slug: string;
  image_url: string;
  start_date: string;
  end_date: string;
  status: string;
  venue_name: string;
  venue_city: string;
  zone_name: string;
  zone_price: number;
  zone_sold: number;
  zone_available: number;
  percent_sold: number;
  zone_color?: string;
}

export interface CustomerHistory {
  customer_id: string;
  full_name: string;
  phone: string;
  email: string;
  total_purchases: number;
  total_spent: number;
  is_vip: boolean;
  order_number: string;
  event_name: string;
  venue_name: string;
  zone_name: string;
  quantity: number;
  total_price: number;
  payment_status: string;
  event_date: string;
}

// Updated Dispersion interface (Liquidaciones)
export interface Dispersion {
  id: string;
  event_id: string;
  schedule_id: string | null;
  period_start: string | null;
  period_end: string | null;
  function_date: string | null;
  gross_revenue: number;
  discounts: number;
  refunds: number;
  net_revenue: number;
  commission_rate: number;
  platform_fee: number;
  ad_spend: number;
  stripe_fee: number;
  net_payout: number;
  status: 'pending' | 'approved' | 'paid';
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

export interface AdSpendDaily {
  id: string;
  event_id: string;
  date: string;
  spend: number;
  source: string;
  campaign_id: string | null;
  synced_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  recipient_email: string;
  subject: string;
  body: string;
  sent_at?: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  event_id: string;
  type: string;
  scheduled_at: string;
  sent_at?: string;
  created_at: string;
}

export interface Survey {
  id: string;
  event_id: string;
  title: string;
  status: string;
  created_at: string;
}

export interface ScannerLink {
  id: string;
  event_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
}

export interface GtmEvent {
  id: string;
  event_name: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

export interface TicketRecovery {
  id: string | number;
  phone: string | null;
  email: string | null;
  event_mentioned: string | null;
  status: string;
  verified: boolean;
  notes: string | null;
  created_at: string;
  customer_id: string | null;
  order_id: string | null;
}

export interface VenueSeat {
  id: string;
  venue_id: string;
  section: string;
  row_label: string;
  seat_number: string;
  seat_type: string;
  sort_order: number;
  x: number;
  y: number;
  created_at: string;
}

export interface EventSection {
  id: string;
  event_id: string;
  schedule_id?: string;
  section: string;
  name: string;
  price: number;
  capacity: number;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface EventSectionSeat {
  id: string;
  event_section_id: string;
  venue_seat_id: string;
  status: string;
  created_at: string;
}

export interface EventCommission {
  id: string;
  event_id: string;
  commission_rate: number;
  created_at: string;
  updated_at: string;
}

async function supabaseFetch<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase error: ${response.status} ${response.statusText} | ${body}`);
  }
  return response.json();
}

// Venue cache and helpers
let venueCache: Map<string, Venue> | null = null;

export async function fetchVenues(): Promise<Venue[]> {
  try {
    return await supabaseFetch<Venue[]>('venues');
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
    return await supabaseFetch<DulosEvent[]>('events?status=eq.active');
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
}

export async function fetchZones(eventId?: string): Promise<TicketZone[]> {
  try {
    const endpoint = eventId
      ? `ticket_zones?event_id=eq.${eventId}`
      : 'ticket_zones';
    return await supabaseFetch<TicketZone[]>(endpoint);
  } catch (error) {
    console.error('Error fetching zones:', error);
    throw error;
  }
}

export async function fetchOrders(): Promise<Order[]> {
  try {
    return await supabaseFetch<Order[]>('orders?order=purchased_at.desc&limit=50');
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
}

export async function fetchEscalations(): Promise<Escalation[]> {
  try {
    return await supabaseFetch<Escalation[]>('escalations?resolved=eq.false');
  } catch {
    // Table may not exist yet — silent fail
    return [];
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
      ? `schedules?event_id=eq.${eventId}`
      : 'schedules';
    return await supabaseFetch<Schedule[]>(endpoint);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    throw error;
  }
}

export async function fetchTickets(): Promise<Ticket[]> {
  try {
    return await supabaseFetch<Ticket[]>('tickets?order=created_at.desc');
  } catch (error) {
    console.error('Error fetching tickets:', error);
    throw error;
  }
}

export async function fetchCoupons(): Promise<Coupon[]> {
  try {
    // Exclude 2X1_AUTO (auto-generated by checkout, not manual coupons)
    return await supabaseFetch<Coupon[]>('coupons?is_active=eq.true&code=neq.2X1_AUTO&order=created_at.desc');
  } catch (error) {
    console.error('Error fetching coupons:', error);
    throw error;
  }
}

export async function fetchCheckins(): Promise<Checkin[]> {
  try {
    return await supabaseFetch<Checkin[]>('checkins?order=scanned_at.desc&limit=20');
  } catch (error) {
    console.error('Error fetching checkins:', error);
    throw error;
  }
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    return await supabaseFetch<AuditLog[]>('audit_logs?order=created_at.desc&limit=100');
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
}

export async function fetchTeam(): Promise<TeamMember[]> {
  try {
    return await supabaseFetch<TeamMember[]>('team_members?order=role');
  } catch (error) {
    console.error('Error fetching team:', error);
    throw error;
  }
}

export async function fetchAllEvents(): Promise<DulosEvent[]> {
  try {
    return await supabaseFetch<DulosEvent[]>('events?order=start_date.desc');
  } catch (error) {
    console.error('Error fetching all events:', error);
    throw error;
  }
}

export async function fetchAllCoupons(): Promise<Coupon[]> {
  try {
    // Exclude 2X1_AUTO (auto-generated by checkout, not manual coupons)
    return await supabaseFetch<Coupon[]>('coupons?code=neq.2X1_AUTO&order=created_at.desc');
  } catch (error) {
    console.error('Error fetching all coupons:', error);
    throw error;
  }
}

export async function fetchEventCommissions(): Promise<EventCommission[]> {
  try {
    return await supabaseFetch<EventCommission[]>('event_commissions');
  } catch {
    return [];
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

export async function fetchAllOrders(): Promise<Order[]> {
  try {
    return await supabaseFetch<Order[]>('orders?order=purchased_at.desc');
  } catch (error) {
    console.error('Error fetching all orders:', error);
    throw error;
  }
}

// Lightweight fetches for SummaryPage — only recent + essential columns
export async function fetchRecentOrders(limit = 50): Promise<Order[]> {
  try {
    return await supabaseFetch<Order[]>(`orders?select=id,order_number,customer_name,customer_email,total_price,payment_status,purchased_at,event_id,quantity,zone_name&order=purchased_at.desc&limit=${limit}`);
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    return [];
  }
}

export async function fetchRecentTickets(limit = 50): Promise<Ticket[]> {
  try {
    return await supabaseFetch<Ticket[]>(`tickets?select=id,ticket_number,event_id,zone_name,customer_name,customer_email,status,created_at,checked_in_at&order=created_at.desc&limit=${limit}`);
  } catch (error) {
    console.error('Error fetching recent tickets:', error);
    return [];
  }
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const [events, zones] = await Promise.all([fetchEvents(), fetchZones()]);
    let totalRevenue = 0, totalTickets = 0;
    try {
      const salesSummary = await fetchSalesSummary();
      totalRevenue = salesSummary.reduce((sum, s) => sum + s.total_revenue, 0);
      totalTickets = salesSummary.reduce((sum, s) => sum + s.total_tickets_sold, 0);
    } catch {
      // Fallback: calculate from orders directly if view doesn't exist
      const orders = await fetchAllOrders();
      const completed = orders.filter(o => o.payment_status === 'completed');
      totalRevenue = completed.reduce((sum, o) => sum + o.total_price, 0);
      totalTickets = completed.reduce((sum, o) => sum + o.quantity, 0);
    }
    const totalSold = zones.reduce((sum, z) => sum + z.sold, 0);
    const totalAvailable = zones.reduce((sum, z) => sum + z.available + z.sold, 0);
    return {
      totalRevenue,
      totalTickets,
      totalEvents: events.length,
      occupancyRate: totalAvailable > 0 ? (totalSold / totalAvailable) * 100 : 0,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

export async function fetchTicketsByEvent(eventId: string): Promise<Ticket[]> {
  try {
    return await supabaseFetch<Ticket[]>(`tickets?event_id=eq.${eventId}&order=created_at.desc`);
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
    return await supabaseFetch<Ticket[]>('tickets?order=created_at.desc&limit=100');
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

export async function fetchNotificationLogs(): Promise<AuditLog[]> {
  try {
    return await supabaseFetch<AuditLog[]>('audit_logs?action=ilike.*notification*&order=created_at.desc&limit=50');
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
    const [events, orders] = await Promise.all([
      fetchAllEvents(),
      fetchAllOrders(),
    ]);

    const eventMap = new Map(events.map(e => [e.id, e]));
    const revenueByEvent = new Map<string, number>();

    // Revenue from completed orders (not zones.sold * zones.price which underestimates)
    orders.forEach(order => {
      if (order.payment_status === 'completed') {
        const current = revenueByEvent.get(order.event_id) || 0;
        revenueByEvent.set(order.event_id, current + order.total_price);
      }
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
      ? `audit_logs?action=ilike.*${actionFilter}*&order=created_at.desc&limit=100`
      : 'audit_logs?order=created_at.desc&limit=100';
    return await supabaseFetch<AuditLog[]>(endpoint);
  } catch (error) {
    console.error('Error fetching filtered audit logs:', error);
    throw error;
  }
}

// New view fetch functions
export async function fetchEventDashboard(): Promise<EventDashboard[]> {
  try {
    return await supabaseFetch<EventDashboard[]>('v_event_dashboard');
  } catch (error) {
    console.error('Error fetching event dashboard:', error);
    throw error;
  }
}

export async function fetchCustomerHistory(customerId: string): Promise<CustomerHistory[]> {
  try {
    return await supabaseFetch<CustomerHistory[]>(`v_customer_history?customer_id=eq.${customerId}&order=purchased_at.desc`);
  } catch (error) {
    console.error('Error fetching customer history:', error);
    throw error;
  }
}

export async function fetchCustomersPaginated(page: number = 1, pageSize: number = 20): Promise<{ data: Customer[]; count: number }> {
  try {
    const offset = (page - 1) * pageSize;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/customers?order=total_spent.desc&limit=${pageSize}&offset=${offset}`, {
      headers: {
        ...headers,
        'Prefer': 'count=exact',
      },
    });
    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status} ${response.statusText}`);
    }
    const contentRange = response.headers.get('content-range');
    const count = contentRange ? parseInt(contentRange.split('/')[1] || '0') : 0;
    const data = await response.json();
    return { data, count };
  } catch (error) {
    console.error('Error fetching paginated customers:', error);
    throw error;
  }
}

// Server-side paginated customer search
export async function fetchCustomersSearchPaginated(
  search: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ data: Customer[]; count: number }> {
  try {
    const offset = (page - 1) * pageSize;
    const searchFilter = search
      ? `&or=(name.ilike.*${encodeURIComponent(search)}*,email.ilike.*${encodeURIComponent(search)}*,phone.ilike.*${encodeURIComponent(search)}*)`
      : '';
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?order=total_spent.desc&limit=${pageSize}&offset=${offset}${searchFilter}`,
      {
        headers: {
          ...headers,
          'Prefer': 'count=exact',
        },
      }
    );
    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status} ${response.statusText}`);
    }
    const contentRange = response.headers.get('content-range');
    const count = contentRange ? parseInt(contentRange.split('/')[1] || '0') : 0;
    const data = await response.json();
    return { data, count };
  } catch (error) {
    console.error('Error searching customers:', error);
    throw error;
  }
}

// Server-side paginated transactions (orders) with sorting and filters
export async function fetchTransactionsPaginated(
  page: number = 1,
  pageSize: number = 10,
  sortColumn: string = 'purchased_at',
  sortDirection: 'asc' | 'desc' = 'desc',
  eventFilter?: string,
  statusFilter?: string,
  search?: string
): Promise<{ data: Order[]; count: number }> {
  try {
    const offset = (page - 1) * pageSize;
    let filters = '';
    if (eventFilter) filters += `&event_id=eq.${encodeURIComponent(eventFilter)}`;
    if (statusFilter) filters += `&payment_status=eq.${encodeURIComponent(statusFilter)}`;
    if (search) {
      filters += `&or=(customer_name.ilike.*${encodeURIComponent(search)}*,customer_email.ilike.*${encodeURIComponent(search)}*,order_number.ilike.*${encodeURIComponent(search)}*)`;
    }
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order=${sortColumn}.${sortDirection}&limit=${pageSize}&offset=${offset}${filters}`,
      {
        headers: {
          ...headers,
          'Prefer': 'count=exact',
        },
      }
    );
    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status} ${response.statusText}`);
    }
    const contentRange = response.headers.get('content-range');
    const count = contentRange ? parseInt(contentRange.split('/')[1] || '0') : 0;
    const data = await response.json();
    return { data, count };
  } catch (error) {
    console.error('Error fetching paginated transactions:', error);
    throw error;
  }
}

// Fetch ticket recovery cases
export async function fetchTicketRecovery(): Promise<TicketRecovery[]> {
  try {
    return await supabaseFetch<TicketRecovery[]>('ticket_recovery?order=created_at.desc');
  } catch (error) {
    console.error('Error fetching ticket recovery:', error);
    throw error;
  }
}

// Fetch all escalations (including resolved)
export async function fetchAllEscalations(): Promise<Escalation[]> {
  try {
    return await supabaseFetch<Escalation[]>('escalations?order=created_at.desc');
  } catch {
    return [];
  }
}

// ─── Paolo's Seat Architecture ───

export async function fetchVenueSeats(venueId: string): Promise<VenueSeat[]> {
  try {
    return await supabaseFetch<VenueSeat[]>(`venue_seats?venue_id=eq.${venueId}&order=sort_order.asc`);
  } catch (error) {
    // silent fail
    return [];
  }
}

export async function fetchEventSections(eventId: string): Promise<EventSection[]> {
  try {
    return await supabaseFetch<EventSection[]>(`event_sections?event_id=eq.${eventId}&order=created_at.asc`);
  } catch {
    // Table may not exist yet — silent fail
    return [];
  }
}

export async function fetchEventSectionSeats(sectionId: string): Promise<EventSectionSeat[]> {
  try {
    return await supabaseFetch<EventSectionSeat[]>(`event_section_seats?event_section_id=eq.${sectionId}`);
  } catch (error) {
    // silent fail
    return [];
  }
}

export async function fetchEventSectionSeatsForEvent(eventId: string): Promise<(EventSectionSeat & { section_name?: string })[]> {
  try {
    // First get sections for this event
    const sections = await fetchEventSections(eventId);
    if (sections.length === 0) return [];

    // Then get all seats for all sections
    const sectionIds = sections.map(s => s.id);
    const filter = sectionIds.map(id => `event_section_id.eq.${id}`).join(',');
    const seats = await supabaseFetch<EventSectionSeat[]>(`event_section_seats?or=(${filter})`);

    // Attach section names
    const sectionMap = new Map(sections.map(s => [s.id, s.name]));
    return seats.map(seat => ({
      ...seat,
      section_name: sectionMap.get(seat.event_section_id) || '',
    }));
  } catch (error) {
    // silent fail
    return [];
  }
}

// ─── Dispersions (Paolo's payout table) ───

export async function fetchAllDispersions(): Promise<Dispersion[]> {
  try {
    return await supabaseFetch<Dispersion[]>('dispersions?order=function_date.desc');
  } catch {
    return []; // Table may not exist yet
  }
}

export async function fetchDispersionsByEvent(eventId: string): Promise<Dispersion[]> {
  try {
    return await supabaseFetch<Dispersion[]>(`dispersions?event_id=eq.${eventId}&order=function_date.desc`);
  } catch {
    return [];
  }
}

export async function fetchDispersions(eventId?: string): Promise<Dispersion[]> {
  try {
    const filter = eventId ? `&event_id=eq.${eventId}` : '';
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dispersions?order=function_date.desc${filter}`, { headers });
    if (!response.ok) return []; // Table may not exist yet
    return response.json();
  } catch {
    return [];
  }
}

export async function createDispersion(data: Omit<Dispersion, 'id' | 'created_at'>): Promise<Dispersion | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dispersions`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        ...data,
        created_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return Array.isArray(result) ? result[0] : result;
  } catch {
    return null;
  }
}

export async function updateDispersion(id: string, data: Partial<Omit<Dispersion, 'id' | 'created_at'>>): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dispersions?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchAdSpendDaily(eventId: string, startDate?: string, endDate?: string): Promise<AdSpendDaily[]> {
  try {
    let filter = `event_id=eq.${eventId}`;
    if (startDate && endDate) {
      filter += `&date=gte.${startDate}&date=lte.${endDate}`;
    }
    return await supabaseFetch<AdSpendDaily[]>(`ad_spend_daily?${filter}&order=date.desc`);
  } catch {
    return [];
  }
}

// ─── Scanner Links ───

export interface ScannerLinkFull {
  id: string;
  event_id: string;
  schedule_id: string | null;
  token: string;
  label: string;
  scans_count: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
}

export async function fetchScannerLinks(eventId?: string): Promise<ScannerLinkFull[]> {
  try {
    const filter = eventId ? `&event_id=eq.${eventId}` : '';
    return await supabaseFetch<ScannerLinkFull[]>(`scanner_links?order=created_at.desc${filter}`);
  } catch {
    return [];
  }
}

export async function createScannerLink(data: { event_id: string; label: string; schedule_id?: string }): Promise<ScannerLinkFull | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/scanner_links`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        event_id: data.event_id,
        label: data.label,
        schedule_id: data.schedule_id || null,
        token: crypto.randomUUID(),
        is_active: true,
        scans_count: 0,
      }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return Array.isArray(result) ? result[0] : result;
  } catch {
    return null;
  }
}

// ─── Pending Guests ───

export async function fetchPendingGuests(): Promise<any[]> {
  try {
    return await supabaseFetch<any[]>('pending_guests?order=created_at.desc');
  } catch {
    return [];
  }
}

// ─── Schedule Inventory ───

export interface ScheduleInventory {
  id: string;
  schedule_id: string;
  zone_id: string;
  total_capacity: number;
  sold: number;
  reserved: number;
  available: number;
  created_at: string;
  updated_at: string;
}

export async function fetchScheduleInventory(scheduleId?: string): Promise<ScheduleInventory[]> {
  try {
    const filter = scheduleId ? `&schedule_id=eq.${scheduleId}` : '';
    return await supabaseFetch<ScheduleInventory[]>(`schedule_inventory?order=created_at.desc${filter}`);
  } catch {
    return [];
  }
}

export async function fetchOrdersBySchedule(scheduleId: string): Promise<Order[]> {
  try {
    return await supabaseFetch<Order[]>(`orders?schedule_id=eq.${scheduleId}&order=purchased_at.desc`);
  } catch {
    return [];
  }
}

// ─── Notifications ───

export async function fetchNotifications(): Promise<Notification[]> {
  try {
    return await supabaseFetch<Notification[]>('notifications?order=created_at.desc&limit=100');
  } catch {
    return [];
  }
}

// ─── Reminders ───

export async function fetchReminders(): Promise<Reminder[]> {
  try {
    return await supabaseFetch<Reminder[]>('reminders?order=created_at.desc&limit=100');
  } catch {
    return [];
  }
}

// ─── Surveys ───

export async function fetchSurveys(): Promise<Survey[]> {
  try {
    return await supabaseFetch<Survey[]>('surveys?order=created_at.desc&limit=100');
  } catch {
    return [];
  }
}

// ─── Blog Posts ───

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  author_id: string | null;
  status: string;
  featured_image: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  try {
    return await supabaseFetch<BlogPost[]>('blog_posts?order=created_at.desc');
  } catch {
    return [];
  }
}

// ─── Pending Guest Status Management ───

export async function updatePendingGuestStatus(id: string, status: string, notes?: string, resolvedBy?: string): Promise<boolean> {
  try {
    // First fetch current data to preserve guests array
    const current = await supabaseFetch<any[]>(`pending_guests?id=eq.${id}`);
    if (!current.length) return false;
    const guests = current[0].guests || [];
    // Update first guest's metadata
    if (guests[0]) {
      guests[0]._status = status;
      if (notes !== undefined) guests[0]._notes = notes;
      if (resolvedBy) guests[0]._resolved_by = resolvedBy;
      if (status === 'resolved') guests[0]._resolved_at = new Date().toISOString();
    }
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pending_guests?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ guests }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ─── WAR ROOM DATA FETCHERS ───

export interface WarRoomKPIs {
  activeEvents: number;
  avgOccupancy: number;
  totalRevenue: number;
  totalAdSpend: number;
}

export interface WarRoomEvent {
  id: string;
  name: string;
  image_url: string;
  venue_name: string;
  venue_city: string;
  next_date: string | null;
  occupancy_pct: number;
  total_sold: number;
  total_capacity: number;
  revenue: number;
  ad_spend: number;
  roas: number | null;
  status: 'on_track' | 'slow' | 'critical';
  sales_trend: number[];
}

export interface WarRoomActivity {
  id: string;
  type: 'sale' | 'checkin';
  customer_name: string;
  event_name: string;
  amount?: number;
  time_ago: string;
}

export async function fetchWarRoomKPIs(): Promise<WarRoomKPIs> {
  try {
    // Count active events with upcoming functions
    const today = new Date().toISOString().split('T')[0];
    const [events, schedules, orders, dispersions] = await Promise.all([
      supabaseFetch<DulosEvent[]>('events?status=eq.active'),
      supabaseFetch<Schedule[]>(`schedules?date=gte.${today}&status=eq.active`),
      supabaseFetch<Order[]>('orders?payment_status=in.(completed,paid)'),
      fetchDispersions(),
    ]);

    // Active events = events with upcoming functions
    const eventsWithUpcomingFunctions = new Set(schedules.map(s => s.event_id));
    const activeEvents = events.filter(e => eventsWithUpcomingFunctions.has(e.id)).length;

    // Get occupancy data
    const [inventory, allSchedules] = await Promise.all([
      supabaseFetch<ScheduleInventory[]>('schedule_inventory'),
      supabaseFetch<Schedule[]>('schedules?status=eq.active')
    ]);

    // Calculate avg occupancy across active events
    const eventOccupancies: { [eventId: string]: { sold: number; capacity: number } } = {};
    
    inventory.forEach(inv => {
      const schedule = allSchedules.find(s => s.id === inv.schedule_id);
      if (schedule && eventsWithUpcomingFunctions.has(schedule.event_id)) {
        if (!eventOccupancies[schedule.event_id]) {
          eventOccupancies[schedule.event_id] = { sold: 0, capacity: 0 };
        }
        eventOccupancies[schedule.event_id].sold += inv.sold;
        eventOccupancies[schedule.event_id].capacity += inv.total_capacity;
      }
    });

    const occupancies = Object.values(eventOccupancies).map(o => 
      o.capacity > 0 ? (o.sold / o.capacity) * 100 : 0
    );
    const avgOccupancy = occupancies.length > 0 ? occupancies.reduce((a, b) => a + b, 0) / occupancies.length : 0;

    // Total revenue
    const totalRevenue = orders.reduce((sum, o) => 
      sum + (o.total_price - (o.discount_amount || 0)), 0
    );

    // Total ad spend
    const totalAdSpend = dispersions.reduce((sum, d) => sum + (d.ad_spend || 0), 0);

    return {
      activeEvents,
      avgOccupancy: Math.round(avgOccupancy),
      totalRevenue,
      totalAdSpend
    };
  } catch (error) {
    console.error('Error fetching war room KPIs:', error);
    throw error;
  }
}

export async function fetchWarRoomEvents(): Promise<WarRoomEvent[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [events, schedules, inventory, orders, dispersions, venues] = await Promise.all([
      supabaseFetch<DulosEvent[]>('events?status=eq.active'),
      supabaseFetch<Schedule[]>(`schedules?date=gte.${today}&status=eq.active&order=date.asc`),
      supabaseFetch<ScheduleInventory[]>('schedule_inventory'),
      supabaseFetch<Order[]>('orders?payment_status=in.(completed,paid)'),
      fetchDispersions(),
      getVenueMap()
    ]);

    // Group data by event
    const eventData: { [eventId: string]: WarRoomEvent } = {};
    
    events.forEach(event => {
      // Get next function for this event
      const eventSchedules = schedules.filter(s => s.event_id === event.id);
      const nextDate = eventSchedules.length > 0 ? eventSchedules[0].date : null;
      
      // Calculate occupancy for NEXT FUNCTION only (not aggregate across all functions)
      // For recurring events, each function's health matters independently
      let totalSold = 0;
      let totalCapacity = 0;
      const nextSchedule = eventSchedules.length > 0 ? eventSchedules[0] : null;
      
      if (nextSchedule) {
        const nextInv = inventory.filter(inv => inv.schedule_id === nextSchedule.id);
        nextInv.forEach(inv => {
          totalSold += inv.sold;
          totalCapacity += inv.total_capacity;
        });
      }

      const occupancyPct = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;
      
      // Calculate revenue for this event (all orders, not just next function)
      const eventOrders = orders.filter(o => o.event_id === event.id);
      const revenue = eventOrders.reduce((sum, o) => 
        sum + (o.total_price - (o.discount_amount || 0)), 0
      );

      // Get ad spend for this event
      const eventDisp = dispersions.filter(d => d.event_id === event.id);
      const adSpend = eventDisp.reduce((sum, d) => sum + (d.ad_spend || 0), 0);
      const roas = adSpend > 0 ? revenue / adSpend : null;

      // Calculate sales trend (last 14 days)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      
      const recentOrders = eventOrders.filter(o => 
        new Date(o.purchased_at) >= fourteenDaysAgo
      );

      // Group by day for sparkline
      const dailySales: { [date: string]: number } = {};
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailySales[dateStr] = 0;
      }

      recentOrders.forEach(order => {
        const dateStr = order.purchased_at.split('T')[0];
        if (dailySales[dateStr] !== undefined) {
          dailySales[dateStr] += (order.total_price - (order.discount_amount || 0));
        }
      });

      const salesTrend = Object.values(dailySales);

      // Calculate status based on expected pace for NEXT FUNCTION
      // Edge cases:
      // - No sales yet → 🟡 (neutral, not enough data to judge)
      // - Event past due (daysUntilEvent <= 0) → use occupancy directly
      // - Low occupancy close to date → 🔴
      let status: 'on_track' | 'slow' | 'critical' = 'on_track';
      
      if (nextDate && eventSchedules.length > 0) {
        const daysUntilEvent = Math.ceil((new Date(nextDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const firstOrderDate = eventOrders.sort((a, b) => new Date(a.purchased_at).getTime() - new Date(b.purchased_at).getTime())[0]?.purchased_at;
        
        if (!firstOrderDate || eventOrders.length === 0) {
          // No sales yet — neutral, can't evaluate pace
          status = 'slow';
        } else if (daysUntilEvent <= 0) {
          // Event is today or past — judge by absolute occupancy
          if (occupancyPct < 50) status = 'critical';
          else if (occupancyPct < 80) status = 'slow';
        } else {
          const daysSinceFirstSale = Math.ceil((new Date().getTime() - new Date(firstOrderDate).getTime()) / (1000 * 60 * 60 * 24));
          const totalDays = daysSinceFirstSale + daysUntilEvent;
          const expectedPace = totalDays > 0 ? (daysSinceFirstSale / totalDays) * 100 : 100;
          
          if (occupancyPct < expectedPace * 0.5) {
            status = 'critical';
          } else if (occupancyPct < expectedPace) {
            status = 'slow';
          }
        }
      }

      const venue = venues.get(event.venue_id);
      
      eventData[event.id] = {
        id: event.id,
        name: event.name,
        image_url: event.image_url || '',
        venue_name: venue?.name || '',
        venue_city: venue?.city || '',
        next_date: nextDate,
        occupancy_pct: Math.round(occupancyPct),
        total_sold: totalSold,
        total_capacity: totalCapacity,
        revenue,
        ad_spend: adSpend,
        roas,
        status,
        sales_trend: salesTrend
      };
    });

    // Filter to only events with upcoming functions and sort by next date
    return Object.values(eventData)
      .filter(e => e.next_date !== null)
      .sort((a, b) => {
        if (!a.next_date || !b.next_date) return 0;
        return new Date(a.next_date).getTime() - new Date(b.next_date).getTime();
      });
      
  } catch (error) {
    console.error('Error fetching war room events:', error);
    throw error;
  }
}

export async function fetchWarRoomActivity(): Promise<WarRoomActivity[]> {
  try {
    const [orders, checkins, events] = await Promise.all([
      supabaseFetch<Order[]>('orders?payment_status=in.(completed,paid)&order=purchased_at.desc&limit=50'),
      supabaseFetch<Checkin[]>('checkins?order=scanned_at.desc&limit=20'),
      fetchAllEvents()
    ]);

    const eventMap = new Map(events.map(e => [e.id, e.name]));
    const activities: WarRoomActivity[] = [];

    // Recent sales
    orders.slice(0, 10).forEach(order => {
      if (order.customer_name) {
        activities.push({
          id: `order-${order.id}`,
          type: 'sale',
          customer_name: order.customer_name,
          event_name: eventMap.get(order.event_id) || order.event_id,
          amount: order.total_price - (order.discount_amount || 0),
          time_ago: formatTimeAgo(order.purchased_at)
        });
      }
    });

    // Recent checkins
    checkins.slice(0, 5).forEach(checkin => {
      if (checkin.customer_name && checkin.customer_name !== 'DUPLICADO') {
        activities.push({
          id: `checkin-${checkin.id}`,
          type: 'checkin',
          customer_name: checkin.customer_name,
          event_name: checkin.event_name,
          time_ago: formatTimeAgo(checkin.scanned_at)
        });
      }
    });

    return activities.sort((a, b) => {
      // Simple sort - sales first, then checkins
      if (a.type === 'sale' && b.type === 'checkin') return -1;
      if (a.type === 'checkin' && b.type === 'sale') return 1;
      return 0;
    }).slice(0, 15);

  } catch (error) {
    console.error('Error fetching war room activity:', error);
    return [];
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

// ─── Check-in (QR Scan → Supabase) ───

export async function createCheckinRecord(data: {
  ticket_id: string;
  ticket_number: string;
  customer_name: string;
  event_name: string;
  venue: string;
  operator_name: string;
}): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/checkins`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        ...data,
        status: 'ok',
        scanned_at: new Date().toISOString(),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function markTicketUsed(ticketId: string): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/tickets?id=eq.${ticketId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        status: 'used',
        used_at: new Date().toISOString(),
        checked_in_at: new Date().toISOString(),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
