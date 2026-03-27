#!/usr/bin/env node
/**
 * Generate venue_seats for a venue section.
 * 
 * Usage:
 *   node scripts/generate-seats.js \
 *     --venue-id "uuid" \
 *     --section-slug "planta-baja" \
 *     --rows 15 \
 *     --seats-per-row 25 \
 *     --start-label A \
 *     --numbering sequential \
 *     --spacing-x 28 \
 *     --spacing-y 32 \
 *     --padding-x 50 \
 *     --padding-y 50 \
 *     --dry-run
 * 
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.
 * Or pass --url and --key directly.
 */

const args = {};
process.argv.slice(2).forEach((arg, i, arr) => {
  if (arg.startsWith('--')) {
    const key = arg.replace(/^--/, '').replace(/-/g, '_');
    const next = arr[i + 1];
    args[key] = (next && !next.startsWith('--')) ? next : true;
  }
});

const SUPABASE_URL = args.url || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = args.key || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const venueId = args.venue_id;
const sectionSlug = args.section_slug;
const numRows = parseInt(args.rows || '10');
const seatsPerRow = parseInt(args.seats_per_row || '20');
const startLabel = args.start_label || 'A';
const numbering = args.numbering || 'sequential'; // 'sequential' | 'odd-even'
const spacingX = parseInt(args.spacing_x || '28');
const spacingY = parseInt(args.spacing_y || '32');
const paddingX = parseInt(args.padding_x || '50');
const paddingY = parseInt(args.padding_y || '50');
const dryRun = args.dry_run === true;

if (!venueId || !sectionSlug) {
  console.error('Usage: --venue-id UUID --section-slug SLUG --rows N --seats-per-row N [--dry-run]');
  process.exit(1);
}

function rowLabel(index) {
  const startCode = startLabel.charCodeAt(0);
  const code = startCode + index;
  if (code <= 90) return String.fromCharCode(code); // A-Z
  // AA, AB, AC...
  const first = Math.floor((code - 65) / 26) - 1;
  const second = (code - 65) % 26;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
}

function seatNumber(seatIndex) {
  if (numbering === 'odd-even') {
    // Odd numbers left, even numbers right
    return seatIndex < seatsPerRow / 2
      ? String(1 + seatIndex * 2)   // 1, 3, 5, 7...
      : String(2 + (seatIndex - Math.ceil(seatsPerRow / 2)) * 2); // 2, 4, 6, 8...
  }
  return String(seatIndex + 1);
}

async function main() {
  // 1. Validate venue exists
  if (!dryRun && (!SUPABASE_URL || !SUPABASE_KEY)) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set (or use --url and --key)');
    process.exit(1);
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  // 2. Look up venue_section
  let venueSectionId = null;
  if (!dryRun) {
    const secRes = await fetch(
      `${SUPABASE_URL}/rest/v1/venue_sections?venue_id=eq.${venueId}&slug=eq.${sectionSlug}&limit=1`,
      { headers }
    );
    const sections = await secRes.json();
    if (!sections || sections.length === 0) {
      console.error(`Error: venue_section not found for venue_id=${venueId} slug=${sectionSlug}`);
      console.error('Create the venue_section first in the admin → Venues → Secciones');
      process.exit(1);
    }
    venueSectionId = sections[0].id;
    console.log(`Found venue_section: ${sections[0].name} (${venueSectionId})`);
  }

  // 3. Generate seats
  const seats = [];
  let sortOrder = 0;

  for (let r = 0; r < numRows; r++) {
    const row = rowLabel(r);
    for (let s = 0; s < seatsPerRow; s++) {
      const seat = seatNumber(s);
      const x = paddingX + s * spacingX;
      const y = paddingY + r * spacingY;
      sortOrder++;

      seats.push({
        venue_id: venueId,
        venue_section_id: venueSectionId,
        section: sectionSlug,
        row_label: row,
        seat_number: seat,
        seat_type: 'standard',
        x: parseFloat(x.toFixed(1)),
        y: parseFloat(y.toFixed(1)),
        sort_order: sortOrder,
      });
    }
  }

  console.log(`\nGenerated ${seats.length} seats:`);
  console.log(`  Rows: ${rowLabel(0)} to ${rowLabel(numRows - 1)} (${numRows} rows)`);
  console.log(`  Seats per row: ${seatsPerRow}`);
  console.log(`  Numbering: ${numbering}`);
  console.log(`  Grid: ${paddingX},${paddingY} → ${paddingX + (seatsPerRow - 1) * spacingX},${paddingY + (numRows - 1) * spacingY}`);
  console.log(`  Section: ${sectionSlug}`);
  console.log(`  Venue: ${venueId}`);

  // Show sample
  console.log('\nSample (first 3 rows):');
  for (let r = 0; r < Math.min(3, numRows); r++) {
    const rowSeats = seats.filter(s => s.row_label === rowLabel(r));
    const first = rowSeats[0];
    const last = rowSeats[rowSeats.length - 1];
    console.log(`  ${first.row_label}: ${first.seat_number}-${last.seat_number} (${rowSeats.length} seats, y=${first.y})`);
  }

  if (dryRun) {
    console.log('\n🏷️  DRY RUN — no data inserted. Remove --dry-run to insert.');
    return;
  }

  // 4. Insert in batches of 100
  const BATCH_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < seats.length; i += BATCH_SIZE) {
    const batch = seats.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/venue_seats`, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}: ${err}`);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${seats.length}...`);
  }

  console.log(`\n✅ ${inserted} seats inserted for ${sectionSlug} in venue ${venueId}`);

  // 5. Update venue_section capacity
  if (venueSectionId) {
    await fetch(`${SUPABASE_URL}/rest/v1/venue_sections?id=eq.${venueSectionId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ capacity: seats.length }),
    });
    console.log(`  Updated venue_section capacity to ${seats.length}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
