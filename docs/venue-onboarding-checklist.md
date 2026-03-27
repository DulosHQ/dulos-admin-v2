# Venue Onboarding Checklist

Proceso estandarizado para dar de alta un venue nuevo en Dulos.
Tiempo estimado: 30-60 minutos.

---

## Paso 1: Crear venue en admin

**Dónde:** admin.dulos.io → Venues → + Nuevo Venue

**Campos obligatorios:**
- Nombre (ej: "Teatro Metropolitano")
- Slug (auto-generado del nombre)
- Ciudad
- Timezone (default: America/Mexico_City)
- Capacidad total

**Campos opcionales:**
- Dirección completa
- Estado
- Código postal
- Google Maps URL
- has_seatmap: ✅ solo si tiene asientos numerados

---

## Paso 2: Definir secciones (solo si has_seatmap = true)

**Dónde:** admin.dulos.io → Venues → [venue] → Secciones → + Agregar sección

**Para cada sección física:**
- Nombre: "Planta Baja", "Balcón", etc. (como se conoce en el venue)
- Slug: auto-generado (planta-baja, balcon)
- Tipo: `reserved` (asientos numerados)
- Capacidad: total de asientos en esa sección
- Orden: 1 = más cercano al escenario

**Nota:** Las zonas comerciales (VIP, General, etc.) se definen por evento en ticket_zones, NO aquí. venue_sections es la estructura FÍSICA permanente del venue.

---

## Paso 3: Cargar asientos (solo si has_seatmap = true)

**Herramienta:** `scripts/generate-seats.js`

```bash
cd dulos-admin

# Dry run primero
node scripts/generate-seats.js \
  --venue-id "UUID_DEL_VENUE" \
  --section-slug "planta-baja" \
  --rows 15 \
  --seats-per-row 25 \
  --start-label A \
  --dry-run

# Si el plan se ve bien, insertar
node scripts/generate-seats.js \
  --venue-id "UUID_DEL_VENUE" \
  --section-slug "planta-baja" \
  --rows 15 \
  --seats-per-row 25 \
  --start-label A
```

**Opciones:**
- `--numbering sequential` (1,2,3...) o `odd-even` (1,3,5... en un lado, 2,4,6... en otro)
- `--spacing-x 28` y `--spacing-y 32` para ajustar separación
- `--padding-x 50` y `--padding-y 50` para margen inicial

**Verificar:** admin.dulos.io → Venues → [venue] → Asientos

---

## Paso 4: Crear SVG del mapa

### Opción A: Generar desde template

```bash
# Template A: 1 zona (venues chicos, GA)
node scripts/generate-svg.js \
  --template a \
  --venue "Teatro Ejemplo" \
  --zone "General" \
  --color "#E63946" \
  --output teatro-ejemplo.svg

# Template B: 2-3 zonas horizontales
node scripts/generate-svg.js \
  --template b \
  --venue "Teatro Ejemplo" \
  --zones '["VIP","Preferente","General"]' \
  --colors '["#E63946","#E88D2A","#2A7AE8"]' \
  --output teatro-ejemplo.svg
```

### Opción B: Editar template manualmente
1. Copiar `templates/svg/template-a-single-zone.svg` o `template-b-multi-zone.svg`
2. Editar con cualquier editor de texto
3. Reemplazar placeholders o ajustar shapes

### Reglas del SVG:
- `data-zone="NombreExacto"` — DEBE coincidir con `ticket_zones.zone_name` (para GA) o con el nombre que se usará al crear el evento
- Labels de texto → FUERA del `<g data-zone>` (el frontend reemplaza fills dentro del group)
- Texto decorativo → `pointer-events: none`
- Solo `path/rect/circle/ellipse/polygon` dentro del `<g data-zone>` group

### Subir SVG:
**Dónde:** admin.dulos.io → Venues → [venue] → Info → 📁 Subir SVG

---

## Paso 5: Validación

- [ ] Cada `data-zone` del SVG coincide con una zone que se usará en ticket_zones
- [ ] venue_seats.count por sección = venue_sections.capacity (verificar en tab Asientos)
- [ ] SVG renderiza correctamente en el admin (preview en tab Info)
- [ ] SVG renderiza en el frontend: `dulos.io/[event-slug]` (después de crear el evento)

---

## Paso 6: Crear evento (después del venue)

1. Crear evento desde el EventWizard con las zonas que correspondan
2. Si el evento es reserved: mapear filas → zonas desde la UI de Mapeo de Asientos
3. Verificar schedule_inventory

---

## FAQ

**¿Cuándo uso venue_sections?**
Solo cuando el venue tiene seatmap (asientos numerados). Para venues GA, déjalas vacías.

**¿Puedo tener un venue con seatmap Y zonas GA?**
Sí. Un evento puede tener zonas reserved Y GA. Las zonas reserved mapean a venue_seats, las GA son solo contadores.

**¿Qué pasa si el productor cambia las zonas?**
Las zonas comerciales viven en ticket_zones, no en venue_sections. Cada evento puede definir zonas diferentes sobre el mismo venue.

**¿Puedo reusar un venue para múltiples eventos?**
Sí. El venue y sus seats son permanentes. Cada evento crea sus propias ticket_zones, event_sections, y event_section_seats.
