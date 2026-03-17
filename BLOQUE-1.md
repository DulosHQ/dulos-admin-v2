# BLOQUE 1 — Vista General (SummaryPage.tsx)

## MISSION
Make the summary page show ALL real data with proper revenue, commission KPI, venue names, and revenue per event breakdown. Everything the owner (Paolo) sees on dulos.io/admin overview must be here.

## SACRED DESIGN RULES (DO NOT BREAK)
- Centered layout, no sidebar, max-width contained
- Event images = DNA — always prominent
- Colors: Red #EF4444, Navy #1E293B, white
- Information density — every pixel works
- Drill-down by clicking, not navigating

## WHAT TO CHANGE IN SummaryPage.tsx

### 1. Revenue KPI — Use v_sales_summary (CRITICAL)
Currently revenue uses `zones.reduce((sum, z) => sum + (z.sold * z.price), 0)` which gives ~$70K.
REAL revenue from v_sales_summary = $605,749.

Import and use `fetchSalesSummary` from supabase.ts:
```ts
const salesSummary = await fetchSalesSummary();
const totalRevenue = salesSummary.reduce((sum, s) => sum + s.total_revenue, 0);
const totalTicketsSold = salesSummary.reduce((sum, s) => sum + s.total_tickets_sold, 0);
const totalOrders = salesSummary.reduce((sum, s) => sum + s.total_orders, 0);
```

### 2. Add Commission KPI
Add 5th metric to HeroMetrics: "Comisión Dulos" = 15% of totalRevenue
Value format: `$${(totalRevenue * 0.15).toLocaleString()} MXN`

You need to update HeroMetrics component to accept a 5th metric (commission).
File: src/components/HeroMetrics.tsx

### 3. Venue Names in Funciones Próximas
Currently shows venue_id or broken venue field. Must resolve venue names.

Import `getVenueMap, getVenueName, getVenueCity` from supabase.ts.
In loadData(), fetch venues and use them:
```ts
const venueMap = await getVenueMap();
// Then in funciones:
sala: getVenueName(event.venue_id, venueMap) + ' · ' + getVenueCity(event.venue_id, venueMap),
```

### 4. Fix date display
Replace `event.dates` with formatted `event.start_date`:
```ts
hora: new Date(event.start_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
```

### 5. Revenue per Event section
Add a new section below HeroMetrics showing revenue by event.
Use salesSummary data to show cards with:
- Event image (from events array, matched by event_name)
- Event name
- Revenue amount formatted
- Number of orders
- Number of tickets sold

Style: grid of cards like the Funciones Próximas section. Each card has event image on left, data on right.

### 6. Sales Trend — use real data
Currently uses zone prices * tickets. Should use order data from salesSummary or daily aggregation.
Since we don't have daily breakdown from v_sales_summary, keep the current approach but use totalRevenue for the trend display context.

### 7. Activity feed — keep but fix amounts
The activity feed currently tries to use order amounts. Since dulos_orders has RLS, the recent orders (fetchOrders with limit=50) may return empty.
Add a fallback: if orders come back empty, show a message "Sin actividad reciente" instead of blank.

## WHAT NOT TO CHANGE
- Alert system (works fine)
- Boletos Vendidos table (works fine with dulos_tickets)
- Expandable event detail panel (works fine)
- Zone details table in expanded view (works fine)
- Overall page structure and layout

## VERIFY
After changes: `npx tsc --noEmit` must pass with zero errors.
