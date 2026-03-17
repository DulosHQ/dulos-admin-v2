# BLOQUE 3 — Eventos (EventsPage.tsx)

## MISSION
Show the full project+event hierarchy that Paolo has on dulos.io/admin. 11 projects, 8 events, venues with names+cities, schedules, and proper status workflows. This is the operational core.

## SACRED DESIGN RULES
- Centered, no sidebar, Red #EF4444, Navy #1E293B, white
- Event images = DNA — always prominent in cards
- Drill-down by clicking (expand inline, never navigate away)

## WHAT TO CHANGE IN EventsPage.tsx

### 1. Add Projects section at the top
Import `fetchProyectos` from supabase.ts.
The 11 projects from dashboard_tabs have:
- Proyecto: "Mijares SinfónicoID: cf5d99c8-..." (name + ID concatenated — PARSE: split at "ID:")
- Productor: "Francisco Paolo Dupeyron Gutierrez" or "$321,989" (second column is money)
- Estado: "PUBLISHED" / "DRAFT" / "ARCHIVED"
- Eventos: "1", "2", etc (count)
- Ingresos: "$357,766" (parse number, remove $ and commas)
- Comisión: "+$35,777" (parse)

Show projects as expandable cards:
- Project name (parsed from "ProyectoID:...")
- Status badge (PUBLISHED=green, DRAFT=yellow, ARCHIVED=gray)
- Revenue + commission inline
- Event count
- Click to expand → shows related events below

### 2. Fix venue display in event cards
Currently EventsPage may use `event.venue` or `event.city` which don't exist.
Import and use `getVenueMap, getVenueName, getVenueCity` from supabase.ts.
Load venues in the data fetch and resolve venue names everywhere.

### 3. Fix date fields
Replace any `event.dates` with `event.start_date` properly formatted:
```ts
new Date(event.start_date).toLocaleDateString('es-MX', { 
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
})
```

### 4. Event cards with real data
Each event card should show:
- Event image (large, prominent — DNA rule)
- Event name
- Venue name + city (from venue resolver)
- Date formatted
- Tickets sold / total available (from zones)
- Revenue (from salesSummary or zones)
- Status badge

### 5. Schedules per event
Use `fetchSchedules(eventId)` to show schedule details when an event is expanded:
- Date, start_time, end_time
- Capacity, sold, percentage bar

### 6. Filter tabs
Keep existing filter (Próximos/Pasados/Todos) but make it work with start_date:
- Próximos: start_date > now
- Pasados: start_date < now
- Todos: all

### 7. Status workflow badges
PUBLISHED → green badge
DRAFT → yellow badge  
ARCHIVED → gray badge
FINALIZADO → blue badge

## IMPORTANT DATA PARSING
The dashboard_tabs data has concatenated strings. Parse carefully:
- "Proyecto" field: "Mijares SinfónicoID: cf5d99c8-ab09-4bd1-8aed-175a396521c5" → name="Mijares Sinfónico", id="cf5d99c8-..."
- "Evento" field: "Así Lo Veo Yo | Nuevo Teatro LibanésPUBLISHED" → name="Así Lo Veo Yo | Nuevo Teatro Libanés", status="PUBLISHED"
- Money fields: "$357,766" → 357766, "+$35,777" → 35777

## WHAT NOT TO CHANGE
- CRUD modal (create/edit event) — keep working
- Archive/delete actions — keep working
- Zone details in expanded view — keep working
- Orders in expanded view — keep working

## VERIFY
After changes: `npx tsc --noEmit` must pass with zero errors.
