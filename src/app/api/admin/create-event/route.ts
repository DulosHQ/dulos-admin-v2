import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

/* ─── Helpers ─── */
async function supaInsert<T>(table: string, data: unknown): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`INSERT ${table} failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  return Array.isArray(json) ? json[0] : json;
}

async function supaDelete(table: string, filter: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE', headers,
  });
}

async function supaFetch<T>(table: string, query: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'GET', headers: { ...headers, 'Prefer': '' },
  });
  if (!res.ok) throw new Error(`FETCH ${table} failed (${res.status})`);
  return res.json();
}

/* ─── Types ─── */
interface ZoneInput {
  zone_name: string;
  zone_type: 'ga' | 'reserved';
  price: number;
  original_price?: number | null;
  total_capacity: number;
  color: string;
  has_2x1: boolean;
  venue_section_ids?: string[];
}

interface ScheduleInput {
  date: string;       // YYYY-MM-DD local
  start_time: string; // HH:MM local
  end_time: string;   // HH:MM local
  total_capacity: number;
  staff_pin: string;
  staff_phone: string;
  staff_email: string;
}

interface EventInput {
  name: string;
  slug: string;
  venue_id: string;
  category: string;
  description: string;
  long_description: string;
  quote: string;
  image_url: string;
  poster_url: string;
  card_url: string;
  seo_title: string;
  seo_description: string;
  show_remaining: boolean;
  featured: boolean;
  sort_order: number;
  status: 'draft' | 'active';
  zones: ZoneInput[];
  schedules: ScheduleInput[];
  commission_rate: number;
  venue_timezone: string;
  seat_assignments?: Record<string, number | { splits: { from: number; to: number; zoneIdx: number }[] }>; // rowKey → whole-row zone index OR splits
  inventory_selections?: Record<string, { enabled: boolean; from: number; to: number; max: number; section: string; label: string; zoneIdx: number }>;
}

/* ─── Main ─── */
export async function POST(req: NextRequest) {
  try {
    const input: EventInput = await req.json();

    // Validate required fields
    if (!input.name) return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 });
    if (!input.venue_id) return NextResponse.json({ error: 'Venue es requerido' }, { status: 400 });
    if (!input.zones?.length) return NextResponse.json({ error: 'Al menos 1 zona es requerida' }, { status: 400 });
    if (!input.schedules?.length) return NextResponse.json({ error: 'Al menos 1 función es requerida' }, { status: 400 });

    // Validate zones
    for (const z of input.zones) {
      if (!z.zone_name) return NextResponse.json({ error: 'Cada zona necesita nombre' }, { status: 400 });
      if (z.price < 0) return NextResponse.json({ error: `Zona "${z.zone_name}": precio inválido` }, { status: 400 });
      if (z.zone_type === 'ga' && z.total_capacity <= 0) return NextResponse.json({ error: `Zona "${z.zone_name}": capacidad requerida para GA` }, { status: 400 });
    }

    // Validate schedules
    for (const s of input.schedules) {
      if (!s.date || !s.start_time) return NextResponse.json({ error: 'Cada función necesita fecha y hora' }, { status: 400 });
    }

    // Validate no duplicate venue_section_ids across zones
    const allSectionIds = input.zones.flatMap(z => z.venue_section_ids || []);
    const sectionIdSet = new Set(allSectionIds);
    if (allSectionIds.length !== sectionIdSet.size) {
      return NextResponse.json({ error: 'Una sección del venue está asignada a más de una zona' }, { status: 400 });
    }

    // Check slug uniqueness
    const slugCheck = await fetch(`${SUPABASE_URL}/rest/v1/events?slug=eq.${encodeURIComponent(input.slug)}&select=id&limit=1`, { headers });
    const existing = await slugCheck.json();
    if (existing?.length > 0) {
      return NextResponse.json({ error: `Slug "${input.slug}" ya existe. Intenta con otro.` }, { status: 409 });
    }

    // ─── Compute derived fields ─── 
    const sortedSchedules = [...input.schedules].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    const first = sortedSchedules[0];
    const last = sortedSchedules[sortedSchedules.length - 1];
    const tz = input.venue_timezone || 'America/Mexico_City';

    // Convert local date+time to UTC timestamptz
    function localToUTC(date: string, time: string): string {
      // Create date in the venue timezone, then let JS convert to UTC
      const dt = new Date(`${date}T${time}:00`);
      // Use Intl to get the offset for the venue timezone
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
      const parts = formatter.formatToParts(dt);
      const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
      // Parse offset like "GMT-6" → -6
      const match = tzPart.match(/GMT([+-]?\d+(?::\d+)?)/);
      let offsetHours = 0;
      if (match) {
        const [h, m] = match[1].split(':').map(Number);
        offsetHours = h + (m ? m / 60 * Math.sign(h) : 0);
      }
      // Construct ISO string with offset
      const sign = offsetHours <= 0 ? '-' : '+';
      const absH = Math.abs(Math.floor(offsetHours));
      const absM = Math.abs(Math.round((offsetHours % 1) * 60));
      const offsetStr = `${sign}${String(absH).padStart(2, '0')}:${String(absM).padStart(2, '0')}`;
      return `${date}T${time}:00${offsetStr}`;
    }

    const startDateUTC = localToUTC(first.date, first.start_time);
    const endDateUTC = localToUTC(last.date, last.end_time || last.start_time);

    const eventType = input.schedules.length === 1 ? 'single' : 'recurring';
    const priceFrom = Math.min(...input.zones.map(z => z.price));
    const maxOriginalPrice = input.zones.some(z => z.original_price && z.original_price > 0)
      ? Math.max(...input.zones.filter(z => z.original_price && z.original_price > 0).map(z => z.original_price!))
      : null;
    const totalCapacity = input.zones.reduce((s, z) => s + z.total_capacity, 0);

    // ─── Track created IDs for rollback ───
    const created: { table: string; filter: string }[] = [];

    try {
      // 1. INSERT event
      const event = await supaInsert<{ id: string }>('events', {
        name: input.name,
        slug: input.slug,
        venue_id: input.venue_id,
        category: input.category,
        event_type: eventType,
        start_date: startDateUTC,
        end_date: endDateUTC,
        price_from: priceFrom,
        original_price: maxOriginalPrice,
        status: input.status,
        description: input.description || null,
        long_description: input.long_description || null,
        quote: input.quote || null,
        image_url: input.image_url || null,
        poster_url: input.poster_url || null,
        card_url: input.card_url || null,
        seo_title: input.seo_title || null,
        seo_description: input.seo_description || null,
        show_remaining: input.show_remaining ?? false,
        featured: input.featured ?? false,
        sort_order: input.sort_order ?? 0,
      });
      created.push({ table: 'events', filter: `id=eq.${event.id}` });

      // 2. INSERT ticket_zones + zone_sections
      const createdZones: { id: string; total_capacity: number; zone_type: string }[] = [];
      for (let zi = 0; zi < input.zones.length; zi++) {
        const z = input.zones[zi];
        const zone = await supaInsert<{ id: string; total_capacity: number }>('ticket_zones', {
          event_id: event.id,
          zone_name: z.zone_name,
          zone_type: z.zone_type,
          price: z.price,
          original_price: z.original_price || null,
          total_capacity: z.total_capacity,
          available: z.total_capacity,
          sold: 0,
          color: z.color || '#cf1726',
          has_2x1: z.has_2x1 ?? false,
        });
        createdZones.push({ ...zone, zone_type: z.zone_type, total_capacity: z.total_capacity });
        created.push({ table: 'ticket_zones', filter: `id=eq.${zone.id}` });

        // Insert zone_sections if venue_section_ids provided
        if (z.venue_section_ids && z.venue_section_ids.length > 0) {
          for (const venueSectionId of z.venue_section_ids) {
            const zs = await supaInsert<{ id: string }>('zone_sections', {
              zone_id: zone.id,
              venue_section_id: venueSectionId,
            });
            created.push({ table: 'zone_sections', filter: `id=eq.${zs.id}` });
          }
        }
      }

      // 2b. (Removed — seat insertion consolidated in Block 5 below)

      // 3. INSERT schedules
      const createdSchedules: { id: string }[] = [];
      for (const s of input.schedules) {
        const schedCapacity = s.total_capacity || totalCapacity;
        const sched = await supaInsert<{ id: string }>('schedules', {
          event_id: event.id,
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time || null,
          total_capacity: schedCapacity,
          sold_capacity: 0,
          reserved_capacity: 0,
          staff_pin: s.staff_pin,
          staff_phone: s.staff_phone || null,
          staff_email: s.staff_email || null,
          status: 'active',
        });
        createdSchedules.push(sched);
        created.push({ table: 'schedules', filter: `id=eq.${sched.id}` });
      }

      // 4. INSERT schedule_inventory (N schedules × M zones)
      for (const sched of createdSchedules) {
        for (const zone of createdZones) {
          const inv = await supaInsert<{ id: string }>('schedule_inventory', {
            schedule_id: sched.id,
            zone_id: zone.id,
            available: zone.total_capacity,
            sold: 0,
            reserved: 0,
          });
          created.push({ table: 'schedule_inventory', filter: `id=eq.${inv.id}` });
        }
      }

      // 5. INSERT event_sections + event_section_seats (for reserved zones with seat assignments)
      let totalEventSeats = 0;
      console.log('[create-event] seat_assignments keys:', input.seat_assignments ? Object.keys(input.seat_assignments).length : 0);
      if (input.seat_assignments && Object.keys(input.seat_assignments).length > 0) {
        // Fetch venue_sections to get slug→id mapping
        const vSecRes = await fetch(
          `${SUPABASE_URL}/rest/v1/venue_sections?venue_id=eq.${input.venue_id}&select=id,slug&limit=100`,
          { headers: { ...headers, 'Prefer': '' } }
        );
        const venueSecs: { id: string; slug: string }[] = vSecRes.ok ? await vSecRes.json() : [];
        const slugToVenueSectionId = new Map<string, string>(venueSecs.map(vs => [vs.slug, vs.id]));
        console.log('[create-event] venue_sections for venue:', JSON.stringify(venueSecs));

        // Get all reserved zones' venue_section_ids (from explicit zone config OR derived from seat_assignments keys)
        const reservedSectionIds = new Set<string>();
        input.zones.forEach(z => {
          if (z.zone_type === 'reserved' && z.venue_section_ids) {
            z.venue_section_ids.forEach(sid => reservedSectionIds.add(sid));
          }
        });

        // If no explicit venue_section_ids on reserved zones, derive from seat_assignments keys
        // Keys are "sectionSlug::rowLabel" — extract unique section slugs and resolve to IDs
        if (reservedSectionIds.size === 0) {
          console.log('[create-event] No explicit venue_section_ids on reserved zones — deriving from seat_assignments keys');
          for (const key of Object.keys(input.seat_assignments!)) {
            const sectionSlug = key.split('::')[0];
            const venueSectionId = slugToVenueSectionId.get(sectionSlug);
            if (venueSectionId) reservedSectionIds.add(venueSectionId);
          }
          console.log('[create-event] Derived reservedSectionIds:', Array.from(reservedSectionIds));
        }

        // Create event_sections for each venue_section
        // event_sections.section (NOT NULL) = venue_section slug/name
        const venueSectionIdToSlug = new Map<string, string>(venueSecs.map(vs => [vs.id, vs.slug]));
        const eventSectionMap = new Map<string, string>(); // venue_section_id → event_section.id
        for (const venueSectionId of reservedSectionIds) {
          const sectionSlug = venueSectionIdToSlug.get(venueSectionId) || 'default';
          const es = await supaInsert<{ id: string }>('event_sections', {
            event_id: event.id,
            venue_section_id: venueSectionId,
            section: sectionSlug,
            price: 0,
          });
          eventSectionMap.set(venueSectionId, es.id);
          created.push({ table: 'event_sections', filter: `id=eq.${es.id}` });
          console.log(`[create-event] Created event_section: ${es.id} for venue_section ${venueSectionId} (${sectionSlug})`);
        }

        // Fetch all venue_seats for this venue (include seat_number for split range matching)
        const seatsRes = await fetch(
          `${SUPABASE_URL}/rest/v1/venue_seats?venue_id=eq.${input.venue_id}&select=id,section,row_label,seat_number&order=sort_order.asc&limit=5000`,
          { headers: { ...headers, 'Prefer': '' } }
        );
        const venueSeats: { id: string; section: string; row_label: string; seat_number?: number }[] = seatsRes.ok ? await seatsRes.json() : [];

        // Build event_section_seats batch
        const essBatch: { event_section_id: string; venue_seat_id: string; zone_id: string | null; status: string }[] = [];
        for (const seat of venueSeats) {
          // seat.section is the slug (e.g., "planta-baja")
          const venueSectionId = slugToVenueSectionId.get(seat.section);
          if (!venueSectionId || !reservedSectionIds.has(venueSectionId)) continue;

          const eventSectionId = eventSectionMap.get(venueSectionId);
          if (!eventSectionId) continue;

          // Get zone assignment from seat_assignments (rowKey = section::row_label → zone index or splits)
          const rowKey = `${seat.section}::${seat.row_label}`;
          const assignment = input.seat_assignments![rowKey];
          let zoneId: string | null = null;
          if (typeof assignment === 'number') {
            zoneId = createdZones[assignment]?.id ?? null;
          } else if (assignment && typeof assignment === 'object' && 'splits' in assignment) {
            const seatNum = (seat as { id: string; section: string; row_label: string; seat_number?: number }).seat_number;
            if (seatNum !== undefined) {
              const matchingSplit = assignment.splits.find(sp => seatNum >= sp.from && seatNum <= sp.to);
              zoneId = matchingSplit ? (createdZones[matchingSplit.zoneIdx]?.id ?? null) : null;
            }
          }

          essBatch.push({
            event_section_id: eventSectionId,
            venue_seat_id: seat.id,
            zone_id: zoneId,
            status: 'available',
          });
        }

        // Batch insert event_section_seats (chunks of 100)
        console.log(`[create-event] event_sections created: ${eventSectionMap.size}, seats to insert: ${essBatch.length}`);
        if (essBatch.length > 0) {
          for (let i = 0; i < essBatch.length; i += 100) {
            const chunk = essBatch.slice(i, i + 100);
            const res = await fetch(`${SUPABASE_URL}/rest/v1/event_section_seats`, {
              method: 'POST', headers, body: JSON.stringify(chunk),
            });
            if (!res.ok) {
              const err = await res.text().catch(() => '');
              throw new Error(`INSERT event_section_seats failed (${res.status}): ${err.slice(0, 200)}`);
            }
          }
          totalEventSeats = essBatch.length;
          // Track for rollback
          for (const esId of eventSectionMap.values()) {
            created.push({ table: 'event_section_seats', filter: `event_section_id=eq.${esId}` });
          }
        }

        // 5a.5: Apply inventory selections (mark for_sale=false for excluded seats)
        if (input.inventory_selections && Object.keys(input.inventory_selections).length > 0) {
          const inv = input.inventory_selections;
          // Build set of venue_seat_ids that should NOT be for_sale
          const notForSaleIds: string[] = [];
          for (const seat of essBatch) {
            // Find venue_seat info to match against inventory
            const vs = venueSeats.find((v: any) => v.id === seat.venue_seat_id);
            if (!vs || vs.seat_number == null) continue;
            const section = vs.section;
            const rowLabel = vs.row_label;
            const seatNum: number = vs.seat_number;

            // Check inventory: try exact key (section:label) and split key (section:label:from-to)
            let isForSale = true;
            let foundInv = false;

            // Try split keys first (section:label:from-to)
            for (const [invKey, invVal] of Object.entries(inv)) {
              const parts = invKey.split(':');
              if (parts.length === 3 && parts[0] === section && parts[1] === rowLabel) {
                // This is a split entry
                const [invFrom, invTo] = parts[2].split('-').map(Number);
                if (seatNum >= invFrom && seatNum <= invTo) {
                  foundInv = true;
                  if (!invVal.enabled) {
                    isForSale = false;
                  } else if (seatNum < invVal.from || seatNum > invVal.to) {
                    isForSale = false;
                  }
                  break;
                }
              }
            }

            // Try whole-row key (section:label)
            if (!foundInv) {
              const wholeKey = `${section}:${rowLabel}`;
              const invEntry = inv[wholeKey];
              if (invEntry) {
                foundInv = true;
                if (!invEntry.enabled) {
                  isForSale = false;
                } else if (seatNum < invEntry.from || seatNum > invEntry.to) {
                  isForSale = false;
                }
              }
            }

            if (!isForSale) {
              notForSaleIds.push(seat.venue_seat_id);
            }
          }

          // Batch UPDATE for_sale=false (chunks of 100)
          if (notForSaleIds.length > 0) {
            console.log(`[create-event] Marking ${notForSaleIds.length} seats as not for sale`);
            for (const esId of eventSectionMap.values()) {
              for (let i = 0; i < notForSaleIds.length; i += 50) {
                const chunk = notForSaleIds.slice(i, i + 50);
                try {
                  const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/event_section_seats?event_section_id=eq.${esId}&venue_seat_id=in.(${chunk.join(',')})`,
                    { method: 'PATCH', headers, body: JSON.stringify({ for_sale: false }) }
                  );
                  if (!res.ok) {
                    console.log(`[create-event] for_sale PATCH warning (${res.status}) — column may not exist yet`);
                  }
                } catch (e: any) {
                  console.log(`[create-event] for_sale PATCH error: ${e.message}`);
                }
              }
            }

            // Update ticket_zones capacity to reflect only for_sale seats
            for (const z of createdZones) {
              if (z.zone_type !== 'reserved') continue;
              const forSaleCount = essBatch.filter(s =>
                s.zone_id === z.id && !notForSaleIds.includes(s.venue_seat_id)
              ).length;
              if (forSaleCount !== z.total_capacity) {
                console.log(`[create-event] Updating zone ${z.id} capacity: ${z.total_capacity} → ${forSaleCount}`);
                await fetch(`${SUPABASE_URL}/rest/v1/ticket_zones?id=eq.${z.id}`, {
                  method: 'PATCH', headers,
                  body: JSON.stringify({ total_capacity: forSaleCount, available: forSaleCount }),
                });
                // Also update schedule_inventory
                for (const sched of createdSchedules) {
                  await fetch(`${SUPABASE_URL}/rest/v1/schedule_inventory?schedule_id=eq.${sched.id}&zone_id=eq.${z.id}`, {
                    method: 'PATCH', headers,
                    body: JSON.stringify({ total_capacity: forSaleCount, available: forSaleCount }),
                  });
                }
              }
            }
          }
        }

        // 5b. Auto-create zone_sections from seat assignments
        // Group: zone_id → Set<venue_section_id> (derived from which sections have seats in each zone)
        const zoneToSections = new Map<string, Set<string>>();
        for (const seat of essBatch) {
          if (!seat.zone_id) continue;
          // Reverse lookup: event_section_id → venue_section_id
          for (const [venueSectionId, eventSectionId] of eventSectionMap.entries()) {
            if (eventSectionId === seat.event_section_id) {
              if (!zoneToSections.has(seat.zone_id)) zoneToSections.set(seat.zone_id, new Set());
              zoneToSections.get(seat.zone_id)!.add(venueSectionId);
              break;
            }
          }
        }
        console.log('[create-event] Auto-creating zone_sections:', Array.from(zoneToSections.entries()).map(([z, s]) => `${z}: ${Array.from(s).join(',')}`));
        for (const [zoneId, venueSectionIds] of zoneToSections) {
          for (const venueSectionId of venueSectionIds) {
            try {
              const zs = await supaInsert<{ id: string }>('zone_sections', {
                zone_id: zoneId,
                venue_section_id: venueSectionId,
              });
              created.push({ table: 'zone_sections', filter: `id=eq.${zs.id}` });
            } catch (e: any) {
              // Ignore duplicate (unique constraint) — zone_sections may already exist from explicit venue_section_ids
              console.log(`[create-event] zone_section insert skipped (may be duplicate): ${e.message}`);
            }
          }
        }
      }

      // 6. INSERT event_commissions
      const comm = await supaInsert<{ id: string }>('event_commissions', {
        event_id: event.id,
        commission_rate: input.commission_rate ?? 0.15,
      });
      created.push({ table: 'event_commissions', filter: `event_id=eq.${event.id}` });

      // Success summary
      const totalZoneSections = input.zones.reduce((sum, z) => sum + (z.venue_section_ids?.length || 0), 0);
      const seatAssignmentCount = input.seat_assignments ? Object.keys(input.seat_assignments).length : 0;
      return NextResponse.json({
        success: true,
        event_id: event.id,
        slug: input.slug,
        summary: {
          zones: createdZones.length,
          schedules: createdSchedules.length,
          inventory_rows: createdSchedules.length * createdZones.length,
          zone_sections: totalZoneSections,
          seat_rows_mapped: seatAssignmentCount,
          event_seats: totalEventSeats,
          commission: input.commission_rate,
          status: input.status,
        },
      });

    } catch (insertError: any) {
      // ─── ROLLBACK: delete in reverse order ───
      console.error('Event creation failed, rolling back:', insertError.message);
      for (let i = created.length - 1; i >= 0; i--) {
        try {
          await supaDelete(created[i].table, created[i].filter);
        } catch (rollbackErr) {
          console.error(`Rollback failed for ${created[i].table}:`, rollbackErr);
        }
      }
      return NextResponse.json({ error: `Error creando evento: ${insertError.message}` }, { status: 500 });
    }

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
  }
}
