# Brief: Rediseño Dashboard Admin Dulos

## Contexto

El dashboard actual repite los mismos datos (revenue, ocupación, boletos vendidos) en 4-6 lugares diferentes. Cada sección intenta ser "completa" por sí sola, lo que genera confusión y ruido. Este rediseño define una sola fuente de verdad para cada tipo de información.

---

## Principio de diseño

Cada sección tiene UN rol claro. Los datos no se repiten entre secciones.

| Sección | Rol | Qué tiene | Qué NO tiene |
|---|---|---|---|
| **Vista General** | War room de sold out | Progreso de eventos, tendencias, alertas | Datos financieros detallados |
| **Finanzas** | Única fuente de verdad financiera | Revenue, comisiones, ad spend, ROAS, desglose por zona | Gestión de eventos |
| **Eventos** | Gestión y edición | Crear/editar eventos, zonas, funciones, compradores | Dashboards, KPIs financieros |
| **Operaciones** | Día del evento | Scanner, check-ins | Todo lo demás (esconder en nav día a día) |
| **Configuración** | Setup | Roles, permisos, equipo, settings | Sin cambios |

---

## 1. VISTA GENERAL — "War Room de Sold Out"

### Objetivo
Al abrir el dashboard, Paolo ve en 3 segundos cómo van TODOS los eventos hacia sold out.

### KPIs globales (top)
Reemplazar los 4 KPI cards actuales. Los nuevos:

| KPI | Qué muestra | Por qué |
|---|---|---|
| Eventos activos | Número de eventos con funciones próximas | Contexto rápido |
| Ocupación promedio | % promedio de ocupación de eventos activos | El north star |
| Revenue total | Suma de ingresos (ya existe, mantener) | Referencia rápida |
| Ad Spend total | Suma de gasto en Meta Ads activo | Para ver spend vs revenue de un vistazo |

### Tabla/cards de eventos (centro)
Reemplazar las event cards actuales. Para cada evento activo mostrar:

| Dato | Formato | Ejemplo |
|---|---|---|
| Nombre + Venue | Texto | "Así Lo Veo Yo · Libanés" |
| Próxima función | Fecha | "29 mar 2026" |
| Ocupación | Barra de progreso + % | ████████░░ 39% |
| Tendencia | Sparkline (ventas últimos 7-14 días) | Mini gráfica inline |
| Ad Spend | Número | "$5,200" |
| Revenue | Número | "$27,408" |
| ROAS | Spend vs Revenue | "5.3x" |
| Estado | Badge visual | 🟢 On track / 🟡 Lento / 🔴 Crítico |

**Ordenar por:** próxima función más cercana primero (lo urgente arriba).

**Estado automático (sugerencia de lógica):**
- 🟢 On track: ocupación ≥ ritmo esperado para días restantes
- 🟡 Lento: ocupación < ritmo esperado pero > 50% del target
- 🔴 Crítico: ocupación muy baja para los días que quedan

### Actividad reciente (abajo)
Mantener como está — últimas órdenes con monto. Es útil para sentir el pulso.

### Qué QUITAR de Vista General
- KPI "Total Órdenes" (redundante, no es el north star)
- KPI "Precio Promedio" (detalle financiero → va en Finanzas)
- KPI "Boletos Vendidos" (se reemplaza por Ocupación %)
- Revenue individual por event card (se simplifica a la tabla)
- "Disponibles" por evento (ruido)

---

## 2. FINANZAS — "Única fuente de verdad financiera"

### Objetivo
Todo lo que sea dinero vive aquí y solo aquí. Cross-evento con drill-down.

### KPIs globales (top)
Mantener los actuales, agregar Ad Spend:

| KPI | Mantener/Nuevo |
|---|---|
| Revenue Total | Mantener ✓ |
| AOV (Ticket Promedio) | Mantener ✓ |
| Órdenes Completadas | Mantener ✓ |
| Ocupación | Mantener ✓ |
| **Ad Spend Total** | **Nuevo** |
| **ROAS Global** | **Nuevo** (Revenue / Ad Spend) |

### Tabla cross-evento
Mantener la tabla actual con estas columnas:

| Columna | Mantener/Nuevo |
|---|---|
| Evento | Mantener ✓ |
| Vendidos | Mantener ✓ |
| Órdenes | Mantener ✓ |
| Revenue | Mantener ✓ |
| Reembolsos | Mantener ✓ |
| Comisión (15%) | Mantener ✓ |
| Capacidad | Mantener ✓ |
| Ocupación | Mantener ✓ |
| % Rev | Mantener ✓ |
| **Ad Spend** | **Nuevo** |
| **ROAS** | **Nuevo** |

### Drill-down por evento (al hacer click en una fila)
Expandir/abrir detalle con:
- Desglose por zona (la tabla que hoy está en Eventos detalle): Zona, Tipo, Precio, Vendidos, Disponibles, Capacidad, Revenue
- Desglose por función (revenue y ocupación por fecha)
- Gráfica de tendencia de ventas en el tiempo (ventas por día/semana)
- Ad Spend de ese evento específico

Esto reemplaza el "Resumen Financiero" que hoy vive dentro de Eventos detalle.

### Tabs existentes
- **Ingresos**: la tabla principal (ya existe, mejorar con ad spend)
- **Tendencias**: agregar gráficas de ventas por evento en el tiempo
- **Transacciones**: mantener como está
- **Comisiones**: mantener como está

---

## 3. EVENTOS — "Pura gestión"

### Objetivo
Crear, editar y administrar eventos. SIN dashboards ni métricas financieras.

### Lista de eventos
Simplificar las event cards. Solo mostrar:

| Dato | Ejemplo |
|---|---|
| Imagen + Nombre | "Así Lo Veo Yo" |
| Venue + Ciudad | "Teatro Libanés, CDMX" |
| Próxima función | "29 mar 2026" |
| Estado | Activo / Borrador / Pasado |
| Funciones | "9 funciones" |

**QUITAR de las event cards:**
- Vendidos (X/Y)
- Ocup: X%
- Revenue: $X
- Dots de funciones

Esos datos viven en Finanzas y Vista General, no aquí.

### Detalle de evento (al hacer click)
El evento detalle se convierte en una página de gestión con tabs:

**Tab "Info":**
- Editar nombre, venue, ciudad, imagen, descripción
- Link a la página pública del evento

**Tab "Funciones":**
- Lista de funciones (fecha, horario, estado)
- Crear / editar / cancelar funciones

**Tab "Zonas y Precios":**
- Tabla de zonas: nombre, tipo (GA/RES), precio, capacidad
- Editar precios, agregar/quitar zonas

**Tab "Compradores":**
- Lista de órdenes de ESE evento
- Filtrar por función, zona, estado
- Detalle de cada orden (comprador, boletos, monto, status)

### Qué QUITAR del detalle de evento
- Header con KPIs (Vendidos, Ocupación, Revenue) → vive en Finanzas
- Resumen Financiero → vive en Finanzas
- Revenue por zona → vive en Finanzas drill-down
- Barra de progreso de ocupación → vive en Vista General
- Cualquier dato monetario → vive en Finanzas

---

## 4. OPERACIONES — Simplificar

### Cambios
- **Scanner/Escaneo**: mantener como está — es funcional y se usa día del evento
- **Clientes**: mover funcionalidad relevante a Eventos → Tab "Compradores"
- **Gestión**: evaluar si se usa; si no, quitar

### Nav
Considerar mover Operaciones a un icono secundario o submenu. No necesita estar al mismo nivel que Vista General, Finanzas y Eventos en el nav principal. Solo es relevante el día del evento.

---

## 5. CONFIGURACIÓN — Sin cambios

Mantener como está. Es setup, se toca poco.

---

## Resumen de la migración de datos

Dónde vive cada dato ANTES y DESPUÉS:

| Dato | ANTES (aparece en) | DESPUÉS (vive solo en) |
|---|---|---|
| Revenue por evento | Vista General + Finanzas + Eventos detalle | **Finanzas** (tabla + drill-down) |
| Ocupación % | Vista General + Finanzas + Eventos lista + Eventos detalle | **Vista General** (overview) + **Finanzas** (tabla) |
| Boletos vendidos | Vista General + Finanzas + Eventos | **Finanzas** (tabla) |
| Órdenes | Vista General + Finanzas | **Finanzas** |
| Revenue por zona | Eventos detalle | **Finanzas** drill-down |
| Tendencia de ventas | No existe | **Nuevo**: Finanzas → Tendencias + Vista General sparklines |
| Ad Spend | No existe | **Nuevo**: Vista General + Finanzas |
| ROAS | No existe | **Nuevo**: Vista General + Finanzas |
| Gestión de evento | Eventos | **Eventos** (sin cambios) |
| Compradores | Operaciones → Clientes | **Eventos** → Tab Compradores |
| Scanner | Operaciones | **Operaciones** (se mantiene, baja de prioridad en nav) |

---

## Fuente de datos para Ad Spend

Para mostrar ad spend y ROAS se necesita jalar data de Meta Marketing API (Insights endpoint). Opciones:

**Opción A (simple):** Cron job que cada 6-12 horas jala spend por campaign via Meta Insights API y lo guarda en la DB asociado al evento (via campaign name que contiene el slug del evento).

**Opción B (manual temporal):** Campo editable en el admin donde Paolo mete el spend manualmente por evento. No escala pero arranca rápido.

**Recomendación:** Opción A. El naming convention de campañas ya está definido (SKILL.md), lo que hace trivial mapear campaign → evento via slug.

---

## Prioridad de implementación

1. **P0 — Vista General** rediseñada (war room de sold out)
2. **P0 — Eventos** limpio (quitar dashboards financieros, dejar solo gestión)
3. **P1 — Finanzas** con drill-down por evento + tendencias
4. **P2 — Ad Spend/ROAS** integración con Meta Insights API
5. **P3 — Operaciones** movido a nav secundario

---

## APÉNDICE TÉCNICO — Queries y lógica de datos

### Definición de "vendido"

Solo contar orders con `payment_status` IN (`completed`, `paid`).

- `pending` = NO contar (transacción no completada)
- `refunded` = NO contar en ventas, mostrar aparte como columna en Finanzas
- Aplicar este filtro en TODAS las queries del dashboard

```sql
WHERE orders.payment_status IN ('completed', 'paid')
```

### Tablas fuente por métrica

| Métrica | Tabla principal | Joins | Notas |
|---|---|---|---|
| Ocupación % por evento | `schedule_inventory` | → `schedules` → `events` | `SUM(sold) / SUM(total_capacity)` agrupado por event_id |
| Ocupación % por función | `schedule_inventory` | → `schedules` | `SUM(sold) / SUM(total_capacity)` agrupado por schedule_id |
| Ocupación % por zona | `schedule_inventory` | → `ticket_zones` | `sold / total_capacity` por zona por función |
| Revenue por evento | `orders` | → `events` | `SUM(total_price - COALESCE(discount_amount, 0))` WHERE status IN ('completed','paid') |
| Revenue por zona | `orders` | — | Agrupar por `zone_name` + `event_id` |
| Tendencia de ventas | `orders` | — | Agrupar por `DATE(purchased_at)` + `event_id`, ORDER BY date |
| Comisión | `orders` + `event_commissions` | JOIN on `event_id` | `net_sales × commission_rate` |
| Compradores por evento | `orders` | → `customers` | Filtrar por `event_id`, JOIN customer data |
| Reembolsos | `orders` | — | `SUM(total_price)` WHERE `payment_status = 'refunded'` |
| Stripe fee | `orders` | — | Campo `stripe_fee` (backfilled via cron) |
| Ad Spend | `dispersions` | — | Campo `ad_spend` (vacío hoy, se llenará desde dashboard de ads en construcción) |
| ROAS | Calculado | `orders` + `dispersions` | `revenue / ad_spend` — mostrar "—" si ad_spend = 0 o null |

### Nota sobre `schedule_id` en orders

La mayoría de orders ya tienen `schedule_id` asignado. Las orders legacy (importadas) pueden no tenerlo. Para el drill-down por función:

- Si `schedule_id` existe → asignar a esa función
- Si `schedule_id` IS NULL → excluir del drill-down por función, pero SÍ incluir en el total del evento

```sql
-- Ocupación por función (solo orders con schedule_id)
SELECT 
  s.id AS schedule_id,
  s.date,
  SUM(si.sold) AS sold,
  SUM(si.total_capacity) AS capacity,
  ROUND(SUM(si.sold)::numeric / NULLIF(SUM(si.total_capacity), 0) * 100, 1) AS occupancy_pct
FROM schedules s
JOIN schedule_inventory si ON si.schedule_id = s.id
WHERE s.event_id = :event_id
  AND s.status = 'active'
GROUP BY s.id, s.date
ORDER BY s.date ASC;
```

### Preguntar a Elliot

Confirmar que `schedule_inventory` se está actualizando activamente (campo `sold` incrementa en cada compra). Si no, la ocupación tendría que calcularse contando tickets/orders por schedule_id en vez de leer de `schedule_inventory.sold`.

### Vista General — Query principal

```sql
-- Eventos activos con ocupación y revenue
SELECT 
  e.id,
  e.name,
  e.slug,
  e.image_url,
  v.name AS venue_name,
  v.city,
  -- Próxima función
  (SELECT MIN(s.date) 
   FROM schedules s 
   WHERE s.event_id = e.id 
     AND s.status = 'active' 
     AND s.date >= CURRENT_DATE) AS next_date,
  -- Ocupación agregada
  COALESCE(inv.total_sold, 0) AS total_sold,
  COALESCE(inv.total_capacity, 0) AS total_capacity,
  ROUND(COALESCE(inv.total_sold, 0)::numeric / NULLIF(inv.total_capacity, 0) * 100, 1) AS occupancy_pct,
  -- Revenue
  COALESCE(rev.total_revenue, 0) AS revenue,
  -- Ad Spend (de dispersions, puede ser null)
  COALESCE(ads.ad_spend, 0) AS ad_spend
FROM events e
JOIN venues v ON v.id = e.venue_id
-- Ocupación
LEFT JOIN (
  SELECT s.event_id, SUM(si.sold) AS total_sold, SUM(si.total_capacity) AS total_capacity
  FROM schedules s
  JOIN schedule_inventory si ON si.schedule_id = s.id
  WHERE s.status = 'active'
  GROUP BY s.event_id
) inv ON inv.event_id = e.id
-- Revenue
LEFT JOIN (
  SELECT event_id, SUM(total_price - COALESCE(discount_amount, 0)) AS total_revenue
  FROM orders
  WHERE payment_status IN ('completed', 'paid')
  GROUP BY event_id
) rev ON rev.event_id = e.id
-- Ad Spend
LEFT JOIN (
  SELECT event_id, SUM(ad_spend) AS ad_spend
  FROM dispersions
  GROUP BY event_id
) ads ON ads.event_id = e.id
WHERE e.status = 'active'
ORDER BY next_date ASC NULLS LAST;
```

### Tendencia de ventas — Query sparkline

```sql
-- Ventas por día para un evento (últimos 30 días)
SELECT 
  DATE(purchased_at) AS sale_date,
  COUNT(*) AS orders_count,
  SUM(quantity) AS tickets_sold,
  SUM(total_price - COALESCE(discount_amount, 0)) AS daily_revenue
FROM orders
WHERE event_id = :event_id
  AND payment_status IN ('completed', 'paid')
  AND purchased_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(purchased_at)
ORDER BY sale_date ASC;
```

### Finanzas — Tabla cross-evento

```sql
-- Tabla financiera principal
SELECT 
  e.id,
  e.name,
  e.image_url,
  e.event_type,
  v.name AS venue_name,
  -- Ventas
  COUNT(DISTINCT o.id) AS total_orders,
  SUM(o.quantity) AS tickets_sold,
  SUM(o.total_price - COALESCE(o.discount_amount, 0)) AS revenue,
  -- Reembolsos
  COALESCE(ref.refund_total, 0) AS refunds,
  -- Comisión
  COALESCE(ec.commission_rate, 0.15) AS commission_rate,
  SUM(o.total_price - COALESCE(o.discount_amount, 0)) * COALESCE(ec.commission_rate, 0.15) AS commission,
  -- Capacidad
  COALESCE(inv.total_capacity, 0) AS capacity,
  ROUND(COALESCE(inv.total_sold, 0)::numeric / NULLIF(inv.total_capacity, 0) * 100, 1) AS occupancy_pct,
  -- Ad Spend + ROAS
  COALESCE(ads.ad_spend, 0) AS ad_spend,
  CASE 
    WHEN COALESCE(ads.ad_spend, 0) > 0 
    THEN ROUND(SUM(o.total_price - COALESCE(o.discount_amount, 0)) / ads.ad_spend, 1)
    ELSE NULL 
  END AS roas
FROM events e
JOIN venues v ON v.id = e.venue_id
LEFT JOIN orders o ON o.event_id = e.id AND o.payment_status IN ('completed', 'paid')
LEFT JOIN event_commissions ec ON ec.event_id = e.id
LEFT JOIN (
  SELECT event_id, SUM(total_price) AS refund_total
  FROM orders WHERE payment_status = 'refunded'
  GROUP BY event_id
) ref ON ref.event_id = e.id
LEFT JOIN (
  SELECT s.event_id, SUM(si.sold) AS total_sold, SUM(si.total_capacity) AS total_capacity
  FROM schedules s JOIN schedule_inventory si ON si.schedule_id = s.id
  WHERE s.status = 'active'
  GROUP BY s.event_id
) inv ON inv.event_id = e.id
LEFT JOIN (
  SELECT event_id, SUM(ad_spend) AS ad_spend
  FROM dispersions GROUP BY event_id
) ads ON ads.event_id = e.id
WHERE e.status IN ('active', 'completed')
GROUP BY e.id, e.name, e.image_url, e.event_type, v.name, ec.commission_rate, inv.total_sold, inv.total_capacity, ads.ad_spend, ref.refund_total
ORDER BY revenue DESC;
```

### UTM tracking — Ya está en la DB

La tabla `orders` ya tiene campos `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`. Esto significa que eventualmente se puede construir un reporte de atribución: "¿cuánto revenue vino de Meta Ads?" filtrando `WHERE utm_source = 'meta' AND utm_medium = 'paid_social'`. No es prioridad ahora pero la data ya se captura.

### Views existentes

Ya existen 3 views que pueden reutilizarse o adaptarse:

- `v_sales_summary` → base para la tabla de Finanzas
- `v_event_dashboard` → base para la Vista General
- `v_customer_history` → base para la tab Compradores en Eventos

Elliot: revisar si estas views ya tienen la lógica correcta de filtrado (`payment_status IN ('completed','paid')`) o si necesitan actualizarse.
