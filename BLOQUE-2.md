# BLOQUE 2 — Finanzas (FinancePage.tsx)

## MISSION
Make the finance page show ALL real data: correct revenue from v_sales_summary, a full Comisiones tab, 1,419 pedidos from dashboard_tabs with pagination, and proper charts. This is what Paolo uses to track money.

## SACRED DESIGN RULES
- Centered, no sidebar, Red #EF4444, Navy #1E293B, white
- Event images = DNA
- Drill-down by clicking
- Sub-tabs inside Finance: Ingresos | Capacidad | Tendencias | Transacciones | **Comisiones** (NEW)

## WHAT TO CHANGE IN FinancePage.tsx

### 1. Fix Revenue — Use v_sales_summary (CRITICAL)
Currently the scorecard uses `zones.sold * zones.price` for revenue (~$70K).
Must use `fetchSalesSummary()` for real revenue (~$605K).

Import `fetchSalesSummary, SalesSummary` from supabase.ts.

In the computed memo, calculate:
```ts
const totalRevenue = salesSummary.reduce((sum, s) => sum + s.total_revenue, 0);
const totalOrders = salesSummary.reduce((sum, s) => sum + s.total_orders, 0);
const totalTicketsSold = salesSummary.reduce((sum, s) => sum + s.total_tickets_sold, 0);
```

### 2. Fix Revenue by Event
Currently uses zones for revenue per event. Must use salesSummary:
```ts
const eventRevenues = salesSummary.map(s => ({
  event_id: s.event_id,
  event_name: s.event_name,
  revenue: s.total_revenue,
  orders: s.total_orders,
  tickets: s.total_tickets_sold,
  image_url: eventMap.get(s.event_id)?.image_url
})).sort((a, b) => b.revenue - a.revenue);
```

### 3. Add Comisiones tab (NEW)
Add a 5th sub-tab: "Comisiones"

This tab shows:
**A) Summary card at top:**
- Total Ingresos: $1,424,152 (or use our v_sales_summary total)
- Comisión Dulos (15%): calculated
- Para Productor (85%): calculated
- Use data from `fetchComisiones()` if available, otherwise calculate from salesSummary

**B) Per-event commission breakdown table:**
| Evento | Ingresos | Comisión (15%) | Productor (85%) | Boletos |
Use salesSummary data. Each row has event image thumbnail.

Style the summary card like the existing FinanceScorecard. Style the table like the Transacciones table (navy header, sortable, paginated).

### 4. Fix Transacciones tab
Currently builds transactions from dulos_tickets with zone price lookup.
Since dulos_orders has RLS, keep the current approach BUT also load data from `fetchPedidos()` (1,419 orders from dashboard_tabs).

Replace the current transaction generation with pedidos data:
```ts
// In the Transacciones tab, use pedidos from dashboard_tabs
const pedidosData = await fetchPedidos();
// pedidos rows have: "ID Pedido", "Evento", "Cliente", "Fecha", "Total", "Comisión", "Productor"
```

Parse pedidos rows into the Transaction interface. Handle the concatenated format:
- "Cliente" = "Name\nEmail" (name and email concatenated)
- "Total" = "$299" (parse number)
- "Comisión" = "+$30" (parse number)
- "ID Pedido" = "#6c3cfef7..." (keep as-is)

### 5. Keep existing charts
The daily revenue chart, day-of-week chart, and occupancy chart can stay as-is.
They use zone data which is fine for trend visualization.

## WHAT NOT TO CHANGE
- Date range filter UI (works fine)
- Event dropdown filter (works fine)
- Export CSV button (works fine)
- Capacity tab (works fine)
- Tendencias tab (works fine)
- FinanceScorecard component (works fine, just feed it correct data)
- CapacityBars component (works fine)

## VERIFY
After changes: `npx tsc --noEmit` must pass with zero errors.
