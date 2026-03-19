const SUPABASE_URL = 'https://udjwabtyhjcrpyuffavz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTM5MzQsImV4cCI6MjA4OTE2OTkzNH0.5RxuCjEPKY2eLmSG8iwMVKJnczcBRNhQH1QADm68UW4';
// Service role key for admin dashboard (authenticated users only, bypasses RLS)
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU5MzkzNCwiZXhwIjoyMDg5MTY5OTM0fQ.-1ABMJP5sYUyW1MDg2W7T8ZE3ipe5x_Lvmec9UdZkO8';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
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
  device_type?: string;
  browser?: string;
  country?: string;
  city?: string;
  referrer_url?: string;
}

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
  ticket_used: boolean;
  event_date: string;
}

// New table interfaces (empty but ready)
export interface Dispersion {
  id: string;
  event_id: string;
  amount: number;
  status: string;
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
  id: string;
  ticket_id: string;
  customer_name: string;
  customer_email: string;
  event_name: string;
  status: string;
  channel: string;
  notes: string;
  created_at: string;
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
  name: string;
  capacity: number;
  created_at: string;
}

export interface EventSectionSeat {
  id: string;
  event_section_id: string;
  venue_seat_id: string;
  status: string;
  created_at: string;
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
    return await supabaseFetch<Coupon[]>('coupons?is_active=eq.true&order=created_at.desc');
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
    return await supabaseFetch<Coupon[]>('coupons?order=created_at.desc');
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

export async function fetchAllOrders(): Promise<Order[]> {
  try {
    return await supabaseFetch<Order[]>('orders?order=purchased_at.desc');
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

    const totalRevenue = salesSummary.reduce((sum, s) => sum + s.total_revenue, 0);
    const totalTickets = salesSummary.reduce((sum, s) => sum + s.total_tickets_sold, 0);
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
  } catch (error) {
    console.error('Error fetching all escalations:', error);
    throw error;
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
    return await supabaseFetch<EventSection[]>(`event_sections?event_id=eq.${eventId}&order=sort_order.asc`);
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

export interface DispersionFull {
  id: string;
  event_id: string;
  period_start: string;
  period_end: string;
  gross_revenue: number;
  discounts: number;
  refunds: number;
  net_revenue: number;
  platform_fee: number;
  ad_spend: number;
  carried_over: number;
  net_payout: number;
  status: string;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
}

export async function fetchDispersions(eventId?: string): Promise<DispersionFull[]> {
  try {
    const filter = eventId ? `&event_id=eq.${eventId}` : '';
    return await supabaseFetch<DispersionFull[]>(`dispersions?order=created_at.desc${filter}`);
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
    return await supabaseFetch<any[]>('tickets?status=eq.pending&order=created_at.desc&limit=50');
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
