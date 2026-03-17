# BLOQUE 4 — Operaciones (OpsPage.tsx)

## MISSION
Add reservas (9,129), boletos (3,912) from dashboard_tabs, enhance customer detail panel, and coupon analytics. NO scanner changes (being built elsewhere).

## SACRED DESIGN RULES
- Centered, no sidebar, Red #EF4444, Navy #1E293B, white
- Drill-down by clicking

## WHAT TO CHANGE IN OpsPage.tsx

### 1. Add Reservas tab/section
Import `fetchReservas` from supabase.ts.
9,129 reservations with: Evento, Cliente, Tipo de Boleto, Cantidad, Estado, Expira, Session ID

Add a "Reservas" sub-tab or section showing:
- Total reservas count (9,129)
- Status breakdown: ACTIVE (green), CONFIRMED (blue), EXPIRED (gray)
- Paginated table (PAGE_SIZE=20) with columns:
  - Evento (parse: "Así Lo Veo Yo | Nuevo Teatro LibanésAsí Lo Veo Yo" → take first part before repeated name)
  - Cliente (may be "Sin email" for anonymous)
  - Tipo de Boleto
  - Cantidad
  - Estado (color-coded badge)
- Search filter by evento or cliente

### 2. Add Boletos tab/section  
Import `fetchBoletos` from supabase.ts.
3,912 tickets with: Boleto (UUID), Evento, Cliente, Tipo, Monto, Estado, Función, Nombre Asistente, Apellido Asistente

Add a "Boletos" sub-tab or section showing:
- Total count (3,912)
- Status breakdown: VALID (green), USED (blue), EXPIRED (red), REFUNDED (orange)
- Paginated table (PAGE_SIZE=20):
  - Boleto ID (truncated UUID, monospace, red color)
  - Evento
  - Cliente (parse concatenated name+email)
  - Tipo (General, Plata, Platino)
  - Monto ($299, $350, etc)
  - Estado (badge)
  - Función (date+time)
- Search filter

### 3. Enhance Customer detail panel
When a customer is clicked in the search results, show:
- Full name + email + phone
- total_spent formatted as currency
- total_orders count
- first_purchase_at / last_purchase_at formatted
- A mini table of their orders/tickets (if joinable by email)

### 4. Coupon analytics
The current coupon section shows a list. Add:
- Usage rate bar for each coupon: used_count / max_uses with percentage
- Color: green if <50% used, yellow if 50-80%, red if >80%
- Total discount value given (used_count * discount_value for fixed, estimated for percentage)

### 5. Organize with sub-tabs
Add sub-tabs within Operaciones:
**Check-ins | Reservas | Boletos | Clientes | Cupones**

Keep the existing check-in and QR scanner section as the first tab.
Move customer search to "Clientes" tab.
Move coupons to "Cupones" tab.

### 6. DO NOT TOUCH the QR scanner
The camera/scanner code stays exactly as-is. Santos is building a separate scanner.

## DATA PARSING for dashboard_tabs
- "Evento" concatenation: "Así Lo Veo Yo | Nuevo Teatro LibanésAsí Lo Veo Yo" 
  → Parse: try to split at known event names, or just truncate at a reasonable length
  → Simple approach: if string > 50 chars, take first 50 + "..."
- "Cliente" concatenation: "Diana Toledoditole1504@gmail.com" → split at email pattern (@)
  → Parse: find @ position, then walk back to find where email starts (lowercase transition)
- "Monto": "$299" → parseFloat after removing $ and commas

## VERIFY
After changes: `npx tsc --noEmit` must pass with zero errors.
