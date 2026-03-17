# BLOQUE 5 — Configuración (AdminPage.tsx)

## MISSION
Enhance the admin page with role permission matrix, better audit logs, and export capabilities.

## SACRED DESIGN RULES
- Centered, no sidebar, Red #EF4444, Navy #1E293B, white

## WHAT TO CHANGE IN AdminPage.tsx

### 1. Role Permission Matrix
Add a visual table showing all roles vs permissions:

Roles (columns): ADMIN, OPERADOR, PRODUCTOR, TAQUILLERO, SOPORTE
Permission groups (rows): group by category

The matrix is already defined in the page as `roleDefinitions`. Make it a visual table with:
- ✅ checkmark (green) where permission exists
- ❌ or empty where it doesn't
- Each role column header colored by role importance
- Expandable per permission group

### 2. Audit Logs improvements
- Add filter dropdown: All / Stripe / User Actions / System
- Use `fetchAuditLogsByAction()` with the filter
- Add export button for audit logs (CSV)
- Show more details in expanded log entry

### 3. Team section improvements  
- Show team member count vs total capacity
- Last login display formatted
- Quick invite form (already exists, ensure it works)

### 4. Export CSV for any section
Add a generic export function that can be reused:
```ts
function exportToCSV(data: any[], filename: string, headers: string[])
```
Add export buttons to: Team list, Audit logs

### 5. System info card
Add a small card showing:
- Supabase status: "Conectado" (green dot)
- Total data: X events, Y tickets, Z customers
- Last data sync time
- Dashboard version: "V2 Beta"

Use data from fetchDashboardStats() or similar.

## WHAT NOT TO CHANGE
- Settings cards and update functionality
- Role definitions (the data is fine)
- Invite user flow
- Overall page structure

## VERIFY
After changes: `npx tsc --noEmit` must pass with zero errors.
