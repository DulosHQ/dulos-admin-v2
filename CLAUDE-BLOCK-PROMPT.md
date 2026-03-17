# DULOS ADMIN V2 — Complete Upgrade

You are upgrading the Dulos Admin V2 dashboard to fully match what the owner (Paolo) demonstrated in his 35-minute video walkthrough, using the REAL V2 Supabase database.

## SACRED DESIGN PHILOSOPHY — BREAK ANY OF THESE AND THE WORK IS REJECTED

1. **Centered layouts** — NO sidebars ever. Max-width contained. Everything centered.
2. **Tab navigation ONLY**: Vista General | Finanzas | Eventos | Operaciones | Configuración
3. **Colors**: Red `#EF4444`, Navy `#1E293B`, white backgrounds. NO pastels, NO other accent colors.
4. **Event images = DNA** — large, prominent, never thumbnails
5. **Header is UNTOUCHABLE**: Dulos icon + bell + user name
6. **"La información te busca a ti"** — drill-down by clicking rows/cards, NOT by navigating to new pages
7. **Every pixel works** — no decorative whitespace, high information density
8. **Never copy dulos.io structure** — integrate their FUNCTIONS into OUR superior centered design

## SUPABASE V2 DATABASE (REAL DATA)

**URL:** `https://udjwabtyhjcrpyuffavz.supabase.co`
**Auth:** Service role key already in `src/lib/supabase.ts`

### Tables with data:
- events (7) — UUID ids, slug, name, status, venue_id, image_url
- venues (6) — name, city, timezone, capacity
- orders (447) — customer_id, event_id, payment_status, total, utm_* fields
- tickets (945) — qr_code, status enum, seat_label, is_buyer, attendee_id
- customers (1,586) — name, email, phone, total_spent, first_purchase_at
- checkins (8) — ticket_id, status enum, scanned_at, operator_name
- ticket_zones (13) — zone_name, price, available, sold, reserved
- schedules (7) — date, start_time, end_time, capacity, status
- coupons (4) — code, type, discount_amount, max_uses, uses_count
- audit_logs (25) — action, entity_type, changes, ip_address
- escalations (3) — description, status, resolved_at
- ticket_recovery (3) — status, channel

### 3 Views (CRITICAL — use these):
- **v_sales_summary** (7 rows): event_id, event_name, venue_name, total_orders, total_tickets_sold, total_revenue, checked_in, refunded — $605,749 MXN total
- **v_event_dashboard**: event_id, event_name, zone_name, zone_price, total_capacity, tickets_sold, occupancy_pct, revenue
- **v_customer_history**: customer_id, full_name, phone, email, total_purchases, total_spent, is_vip, order_number, event_name, venue_name, zone_name, quantity, total_price, payment_status, ticket_used, event_date

### Tables EMPTY (don't build UI for these):
team_members, dispersions, notifications, reminders, surveys, scanner_links, gtm_events, venue_seats, event_sections, event_section_seats

### Enums:
- order_payment_status: pending, completed, refunded, failed
- ticket_status: valid, used, cancelled, refunded, expired
- event_status: draft, active, sold_out, cancelled, completed
- schedule_status: active, cancelled, completed
- checkin_status: success, invalid, already_used

### Revenue by event:
Mijares $359K, Así Lo Veo Yo $149K, El Maleficio $52K, Lucero $28K, Infierno $13K, Oh Karen $2.5K

## WHAT PAOLO'S VIDEO SHOWED (what we MUST match):

### 1. Vista General (SummaryPage.tsx)
- **4 KPI cards** at top: Total Revenue, Total Orders, Tickets Sold, Average Ticket Price
- **KPIs need period comparison**: "+10% vs last period" badges (green/red)
- **Revenue trend chart** — area/line chart with date range
- **Upcoming shows** with expand-to-drill-down (event image + zones + capacity)
- **Activity feed** — real recent orders/checkins/ticket actions

### 2. Finanzas (FinancePage.tsx)
- **4 KPI cards**: Net Sales, Total Orders, Tickets Sold, Avg Ticket Price
- **"Aplicar Filtros" pattern**: Dropdown filters + "Aplicar" + "Limpiar" buttons (NOT auto-apply)
- **Revenue trend**: Area chart by day with Recharts
- **Revenue by event**: Donut/bar chart showing breakdown
- **Revenue by zone**: Donut showing zone distribution
- **Transactions table**: Sortable columns (date, customer, event, amount, status), with server-side pagination for 447 orders
- **Daily distribution chart**: Bar chart of ticket volume per day
- **Commission = 10%** (NOT 15%)
- **Period comparison**: Show % change vs previous period on KPI cards

### 3. Eventos (EventsPage.tsx)
- **Event cards** — large image, name, venue, date, status badge
- **Toggle**: Próximos / Pasados / Todos
- **Drill-down on click**: Expand to show schedules, zones, capacity, occupancy via v_event_dashboard
- **Status badges**: draft/active/sold_out/cancelled/completed with color coding
- **Event CRUD**: Create/Edit modal (but keep simple — data goes to Supabase)
- **Zone breakdown per event**: Show each zone's sold/available/revenue

### 4. Operaciones (OpsPage.tsx)
- **3 sub-tabs**: Check-ins | Clientes | Cupones
- **Check-ins tab**: Table of scans with status badges (success/invalid/already_used), operator name
- **Clientes tab**: 
  - Search by name/email/phone
  - **SERVER-SIDE PAGINATION** (1,586 customers — DO NOT load all at once)
  - Customer cards with: name, email, phone, total_spent, total_purchases, is_vip badge
  - **DRILL-DOWN** on click: expand to show full purchase history via v_customer_history (orders, events attended, tickets, payment status)
- **Cupones tab**: Table with code, type, discount, uses/max_uses, event, status. CRUD modal.
- **Ticket recovery**: Show 3 pending recovery cases
- **Escalations**: Show 3 escalation cases with status

### 5. Configuración (AdminPage.tsx)
- **Team members** — table/cards (even if empty, show the UI ready)
- **Audit logs** — collapsible list, 25 entries, show action/entity/timestamp/changes
- **Settings cards** — platform configuration

## WHAT TO FIX/ADD IN EACH FILE:

### supabase.ts — Data Layer
- Add `fetchTransactions()` with server-side pagination (Range headers), sorting, filters
- Add `fetchCustomers()` with server-side pagination and search
- Add `fetchCheckins()` 
- Add `fetchTicketRecovery()`
- Add `fetchEscalations()`
- Add `fetchEventDashboard(eventId)` — uses v_event_dashboard
- Verify `fetchCustomerHistory(customerId)` works correctly
- Add `fetchAuditLogs()` with pagination
- Add count queries using `Prefer: count=exact` header for pagination

### SummaryPage.tsx
- Wire KPIs to REAL aggregated data from v_sales_summary
- Period comparison badges (calculate % change)
- Remove any fake/hardcoded sparkline data
- Activity feed from recent orders + checkins (real timestamps)

### FinancePage.tsx
- "Aplicar Filtros" button pattern (NOT auto-apply on dropdown change)
- Revenue by event from v_sales_summary
- Revenue by zone from ticket_zones
- Transactions table with server-side pagination + sorting
- Commission at 10%
- Period comparison on KPI cards
- Daily distribution chart from orders grouped by date

### EventsPage.tsx
- Event cards with large images
- Drill-down showing v_event_dashboard data (zones, occupancy, revenue)
- Status badges with correct enum colors
- Schedule info per event

### OpsPage.tsx
- Customer search with server-side pagination (NOT load all 1,586)
- Customer drill-down with v_customer_history
- Check-ins table with real data
- Coupons CRUD
- Ticket recovery section
- Escalations section

### AdminPage.tsx
- Team members UI (ready for when data exists)
- Audit logs with 25 real entries, collapsible detail
- Settings cards

## EXECUTION RULES

1. Work through each page file one at a time
2. After each file, run `npx next build` — MUST be 0 errors
3. Do NOT create new page files — only modify existing ones
4. Do NOT change the tab structure or header
5. Do NOT add a sidebar
6. Use Recharts for all charts (already installed)
7. Use Sonner for toasts (already installed)
8. Use Tailwind for all styling (already configured)
9. Keep all Supabase calls in `src/lib/supabase.ts`
10. TypeScript strict — no `any` types, proper interfaces
11. All text in Spanish (es-MX locale for numbers/dates)
12. Responsive — must work on mobile
13. Commission is 10% everywhere

## START NOW

Begin with `src/lib/supabase.ts` (data layer), then SummaryPage, FinancePage, EventsPage, OpsPage, AdminPage. Build after each file. Zero errors tolerance.
