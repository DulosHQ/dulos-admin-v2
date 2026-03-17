# BLOQUE 0 — Data Layer Fix

## MISSION
Fix the data layer (src/lib/supabase.ts) so ALL data from the Dulos admin dashboard is accessible. This is the foundation — every page depends on this.

## WHAT TO DO

### 1. Fix DulosEvent interface
The current interface has fields that DON'T match the real schema.

**Current (WRONG):**
```ts
interface DulosEvent {
  id: string;
  name: string;
  venue: string;    // WRONG — doesn't exist
  city: string;     // WRONG — doesn't exist  
  dates: string;    // WRONG — doesn't exist
  status: string;
  image_url: string;
  buy_url: string;  // WRONG — doesn't exist
}
```

**Real schema (from Supabase):**
```ts
interface DulosEvent {
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
```

### 2. Add Venue interface and fetch
```ts
interface Venue {
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
```

Add `fetchVenues()` function.

### 3. Add Dashboard Tabs fetch functions
The `dulos_dashboard_tabs` table has ALL scraped data from the reference site.

Structure: `{ id, tab_name, headers: string[], row_data: object[], total_rows: number, captured_at }`

Add these fetch functions:
```ts
// Fetch all rows from a specific tab (paginated across multiple records)
async function fetchDashboardTab(tabName: string): Promise<{ headers: string[]; rows: any[]; totalRows: number }>

// Convenience functions
fetchProyectos()   // 11 projects with: Proyecto, Productor, Estado, Eventos, Ingresos, Comisión
fetchPedidos()     // 1,419 orders with: ID Pedido, Evento, Cliente, Fecha, Total, Comisión
fetchBoletos()     // 3,912 tickets with: Boleto, Evento, Cliente, Tipo, Monto, Estado, Función
fetchReservas()    // 9,129 reservations with: Evento, Cliente, Tipo de Boleto, Cantidad, Estado
fetchComisiones()  // 1 commission summary: Productor, Eventos, Órdenes, Ingresos, Comisión Total
```

### 4. Fix fetchDashboardStats to use v_sales_summary
The `v_sales_summary` view works with anon key and has REAL revenue data:
```json
[
  {"event_name": "Mijares Sinfónico", "total_orders": 105, "total_tickets_sold": 227, "total_revenue": 359015},
  {"event_name": "Así Lo Veo Yo", "total_orders": 224, "total_tickets_sold": 500, "total_revenue": 149481},
  ...
]
```

Add:
```ts
interface SalesSummary {
  event_id: string;
  event_name: string;
  venue_name: string;
  total_orders: number;
  total_tickets_sold: number;
  total_revenue: number;
  checked_in: number;
  refunded: number;
}

fetchSalesSummary(): Promise<SalesSummary[]>
```

### 5. Update ALL pages that use DulosEvent
After changing the interface, you MUST update every file that references the old fields:
- `event.venue` → need to resolve via venue_id join or venue map
- `event.city` → same, from venues
- `event.dates` → use `event.start_date` formatted
- `event.buy_url` → remove references

Files to check:
- src/pages/SummaryPage.tsx (uses event.venue, event.dates)
- src/pages/FinancePage.tsx
- src/pages/EventsPage.tsx (uses event.venue, event.city)
- src/pages/OpsPage.tsx
- src/components/UpcomingShows.tsx

### 6. Create a venue resolver helper
```ts
// Call fetchVenues() once, create a Map<string, Venue>, and export a helper
let venueCache: Map<string, Venue> | null = null;
async function getVenueMap(): Promise<Map<string, Venue>>
function getVenueName(venueId: string, venueMap: Map<string, Venue>): string
function getVenueCity(venueId: string, venueMap: Map<string, Venue>): string
```

## CONSTRAINTS
- Don't change any UI/component code in this block (that's for later blocks)
- Don't add new npm dependencies
- Don't change the headers/auth setup
- Keep all existing fetch functions working (backward compatible)
- The `dulos_orders` table has RLS — returns 0 rows with anon key. Use `v_sales_summary` instead for revenue data.

## VERIFY
After changes, run `npx tsc --noEmit` to check for type errors. Fix ALL of them.
