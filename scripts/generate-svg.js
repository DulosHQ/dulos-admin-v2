#!/usr/bin/env node
/**
 * Generate venue SVG from templates.
 * 
 * Usage:
 *   node scripts/generate-svg.js --template a --venue "Teatro Ejemplo" --zone "General" --color "#E63946"
 *   node scripts/generate-svg.js --template b --venue "Teatro Ejemplo" --zones '["VIP","Preferente","General"]' --colors '["#E63946","#E88D2A","#2A7AE8"]'
 *   node scripts/generate-svg.js --template b --venue "Teatro Ejemplo" --zones '["Luneta","Mezzanine"]' --colors '["#E63946","#2A7AE8"]' --output teatro-ejemplo.svg
 */

const fs = require('fs');
const path = require('path');

const args = {};
process.argv.slice(2).forEach((arg, i, arr) => {
  if (arg.startsWith('--')) {
    const key = arg.replace('--', '');
    args[key] = arr[i + 1] || '';
  }
});

const template = args.template || 'a';
const venueName = args.venue || 'VENUE NAME';
const output = args.output || null;

if (template === 'a') {
  // Single zone template
  const zoneName = args.zone || 'General';
  const color = args.color || '#E63946';
  
  const tpl = fs.readFileSync(path.join(__dirname, '../templates/svg/template-a-single-zone.svg'), 'utf-8');
  const svg = tpl
    .replace(/\{\{VENUE_NAME\}\}/g, venueName.toUpperCase())
    .replace(/\{\{ZONE_1_NAME\}\}/g, zoneName)
    .replace(/\{\{ZONE_1_COLOR\}\}/g, color);

  if (output) {
    fs.writeFileSync(output, svg);
    console.log(`✅ SVG saved to ${output}`);
  } else {
    process.stdout.write(svg);
  }

} else if (template === 'b') {
  // Multi-zone template
  let zones, colors;
  try {
    zones = JSON.parse(args.zones || '["General"]');
    colors = JSON.parse(args.colors || '["#E63946"]');
  } catch (e) {
    console.error('Error: --zones and --colors must be valid JSON arrays');
    process.exit(1);
  }

  // Pad colors if fewer than zones
  while (colors.length < zones.length) colors.push('#555');

  // Layout calculations
  const PADDING_TOP = 40;
  const ZONE_GAP = 10;
  const ZONE_HEIGHT = 90;
  const AISLE_HEIGHT = 30;
  const STAGE_HEIGHT = 50;
  const BRAND_HEIGHT = 30;
  const PADDING_BOTTOM = 20;

  const zonesHeight = zones.length * ZONE_HEIGHT + (zones.length - 1) * ZONE_GAP;
  const totalHeight = PADDING_TOP + zonesHeight + AISLE_HEIGHT + STAGE_HEIGHT + BRAND_HEIGHT + PADDING_BOTTOM;

  // Generate zone blocks (farthest from stage = first = top)
  let zoneBlocks = '';
  zones.forEach((name, i) => {
    const y = PADDING_TOP + i * (ZONE_HEIGHT + ZONE_GAP);
    const color = colors[i];
    const labelY = y + ZONE_HEIGHT / 2;

    zoneBlocks += `
  <!-- Zone: ${name} -->
  <g data-zone="${name}" data-zone-type="ga" style="cursor:pointer">
    <rect x="50" y="${y}" width="300" height="${ZONE_HEIGHT}" rx="6" fill="${color}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
  </g>
  <text x="200" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-family="Inter,Helvetica Neue,Arial,sans-serif" font-weight="700" font-size="18" fill="#ffffff" style="pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,0.8)">${name}</text>
`;
  });

  const aisleY = PADDING_TOP + zonesHeight + 10;
  const stageY = aisleY + AISLE_HEIGHT + 5;
  const stageTextY = stageY + 30;
  const brandY = stageY + STAGE_HEIGHT + 20;

  const tpl = fs.readFileSync(path.join(__dirname, '../templates/svg/template-b-multi-zone.svg'), 'utf-8');
  const svg = tpl
    .replace(/\{\{SVG_HEIGHT\}\}/g, String(totalHeight))
    .replace(/\{\{VENUE_NAME\}\}/g, venueName.toUpperCase())
    .replace(/\{\{ZONE_BLOCKS\}\}/g, zoneBlocks)
    .replace(/\{\{AISLE_Y\}\}/g, String(aisleY))
    .replace(/\{\{STAGE_Y\}\}/g, String(stageY))
    .replace(/\{\{STAGE_TEXT_Y\}\}/g, String(stageTextY))
    .replace(/\{\{BRAND_Y\}\}/g, String(brandY));

  if (output) {
    fs.writeFileSync(output, svg);
    console.log(`✅ SVG saved to ${output} (${zones.length} zones, ${totalHeight}px height)`);
  } else {
    process.stdout.write(svg);
  }

} else {
  console.error(`Unknown template: ${template}. Use 'a' (single zone) or 'b' (multi zone).`);
  process.exit(1);
}
