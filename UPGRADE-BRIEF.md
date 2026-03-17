# Dulos Admin V2 — Full Rationalization Upgrade

## MISSION
Upgrade every page of this dashboard so ALL data and ALL functions from the reference platform (dulos.io/admin) work with OUR design philosophy. The current code already has the right structure — enhance it, don't rebuild.

## SACRED DESIGN RULES (NEVER BREAK)
- **Centered layouts** — no sidebars, max-width contained
- **Tab navigation** — Vista General / Finanzas / Eventos / Operaciones / Configuración
- **Colors:** Red #EF4444 (accent), Navy #1E293B (headers/dark), white backgrounds
- **Event images = DNA** — always prominent, never shrink
- **"La información te busca a ti"** — drill-down by clicking, not navigating to new pages
- **Information density** — every pixel works, no dead white space
- **Font hierarchy:** extrabold for values, bold for labels, medium for secondary

## DATA LAYER (src/lib/supabase.ts)

### CRITICAL BUG — Revenue Calculation
The `SummaryPage` calculates revenue from `zones.sold * zones.price` which gives ~$70K.
The REAL revenue is in `dulos_orders.total_price` — SUM = ~$605,749.
**FIX:** SummaryPage must use `fetchAllOrders()` and sum `total_price` for revenue, NOT zones.

### Available Tables & Row Counts
- `dulos_events` — 7 events (active + past)
- `dulos_ticket_zones` — 13 zones (price, sold, available per event)
- `dulos_orders` — 447 orders (customer_name, email, phone, total_price, payment_status, stripe_payment_id, zone_name, quantity, purchased_at)
- `dulos_tickets` — 946 tickets (ticket_number, ticket_token, event_id, zone_name, status, customer_name, customer_email)
- `customers` — 1,344 customers (name, last_name, email, phone, total_spent, total_orders, first_purchase_at, last_purchase_at)
- `dulos_schedules` — 34 schedules (date, start_time, end_time, total_capacity, sold_capacity, status)
- `dulos_checkins` — 20 check-ins (ticket_number, customer_name, event_name, operator_name, status, scanned_at)
- `dulos_coupons` — 3 coupons (code, discount_type, discount_value, used_count, max_uses, is_active)
- `dulos_team` — 5 team members (name, email, role, is_active)
- `dulos_audit_logs` — 20 logs (user_email, action, entity_type, details)
- `dulos_escalations` — 3 escalations
- `dulos_projects` — 10 projects (name, producer, status, image_url, events array)
- `dulos_ui_captures` — 117 UI screenshots from reference
- `dulos_dashboard_tabs` — 6 tabs with all row data from reference
- `v_sales_summary` — view aggregating sales per event

### Functions That Already Exist in supabase.ts
All fetch functions are working. The types are correct. Don't modify the fetch layer unless adding a new query.

## UPGRADE BY PAGE

### 1. SummaryPage (Vista General) — PRIORITY FIXES
**Bug:** Revenue shows ~$70K (from zones) instead of ~$605K (from orders)
- Use `fetchAllOrders()` → sum `total_price` for the revenue KPI
- Keep zones for occupancy calculation (that's correct)
- Sales trend should also use orders (purchased_at + total_price) not tickets

**Missing features to add:**
- Revenue per event breakdown (mini cards with event image + revenue amount)
- Quick-filter by event on the summary page (dropdown like FinancePage has)
- "Comisiones del mes" KPI card (15% of revenue = Dulos commission)
- Better sparklines using real daily data from orders

### 2. FinancePage (Finanzas) — RATIONALIZE
**Bug:** Same revenue bug — uses `zones.sold * zones.price` instead of orders
- Scorecard revenue must come from `dulos_orders.total_price`
- Revenue by event should use orders grouped by event_id, not zones
- Daily revenue chart should use orders.purchased_at + total_price

**Add missing:**
- Commissions tab (15% of each order = Dulos cut, 85% = producer cut)
- Show Stripe payment IDs in transaction detail (data exists in orders.stripe_payment_id)
- Revenue comparison: this period vs previous period (percentage change)
- Producer breakdown: revenue per producer (from dulos_projects.producer)

### 3. EventsPage (Eventos) — ENHANCE
**Currently good but missing:**
- Project concept: events belong to projects. Show project cards that expand to show their events
- Use `dulos_projects` table (10 projects with name, producer, status, image_url, events[])
- Each project card: image, name, producer name, status badge, event count
- Click project → expand inline to show its events with zones, schedules, orders
- Schedule management: show all schedules per event (date, time, capacity, sold)
- Status workflow: BORRADOR → PUBLICADO → FINALIZADO → ARCHIVADO

### 4. OpsPage (Operaciones) — ENHANCE
**Currently has:** QR scanner, check-ins, coupons, customer search
**Add:**
- Customer detail panel: when clicking a customer, show full profile (total_spent, order history, all tickets)
- Link customers to their orders and tickets (join by email)
- Notification logs section (from audit_logs filtered by notification actions)
- Check-in statistics: total scanned today, scan rate, operator performance
- Coupon usage analytics: which coupons are performing, conversion rate

### 5. AdminPage (Configuración) — ENHANCE
**Currently has:** Team list, roles, audit logs, settings
**Add:**
- Role permission matrix visualization (table showing role × permission)
- Team member activity: last login, actions performed (from audit_logs)
- System health indicators: API status, Stripe connection, Supabase status
- Export capabilities: CSV export for any data section

## COMPONENT IMPROVEMENTS

### HeroMetrics — Add commission KPI
Add a 5th metric: "Comisión Dulos" = 15% of total revenue

### CapacityBars — Already good, no changes needed

### FinanceScorecard — Fix to use order-based revenue

### RecentFeed — Not currently used, wire it up or remove

### SalesTrend — Not currently used, wire it up or remove

## TECHNICAL CONSTRAINTS
- **Next.js 15 + React 19** — use 'use client' for all pages
- **No SDK** — all Supabase calls go through REST API (fetch with apikey header)
- **Recharts** for all charts
- **Sonner** for toasts
- **Zod** for form validation
- **Tailwind** for styling — use existing CSS variables and utility classes
- **Server actions** in `src/app/actions/` for mutations

## WHAT NOT TO DO
- Don't add a sidebar
- Don't change the header (AdminHeader.tsx)
- Don't change the tab navigation structure (AdminNav.tsx)  
- Don't add new pages/routes — everything happens within the 5 tabs
- Don't remove any existing functionality
- Don't change the color scheme
- Don't add new npm dependencies

## ORDER OF OPERATIONS
1. Fix the revenue bug in SummaryPage (most visible, most impactful)
2. Fix the revenue bug in FinancePage
3. Add commission calculations everywhere
4. Add project hierarchy to EventsPage
5. Enhance OpsPage customer details
6. Polish AdminPage with role matrix
7. Clean up unused components
