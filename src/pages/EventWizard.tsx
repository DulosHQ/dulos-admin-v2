'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';

/* ─── Constants ─── */
const CATEGORIES = ['teatro', 'concierto', 'festival', 'standup', 'comedia', 'musical', 'otro'];
const ZONE_COLORS = ['#E63946', '#2A7AE8', '#E88D2A', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4'];
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const STEP_LABELS_5 = ['Info', 'Fechas', 'Zonas', 'Organizador', 'Revisión'];
const STEP_LABELS_6 = ['Info', 'Fechas', 'Zonas', 'Mapeo', 'Organizador', 'Revisión'];
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);
const fmtDateDay = (d: string) => {
  if (!d) return '—';
  try {
    const dt = new Date(d + 'T12:00:00');
    if (isNaN(dt.getTime())) return d;
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${days[dt.getDay()]} ${dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  } catch { return d; }
};

/* ─── Types ─── */
interface Venue {
  id: string; name: string; slug: string; address: string; city: string; state: string;
  timezone: string; capacity: number; has_seatmap: boolean; layout_svg_url: string | null;
}
interface VenueSection { id: string; name: string; slug: string; section_type: string; capacity: number; }

interface VenueSeatWizard { id: string; venue_id: string; section: string; row_label: string; seat_number: number; }
interface RowGroup { label: string; section: string; seatCount: number; seatIds: string[]; minSeat: number; maxSeat: number; }
interface RowSplit { from: number; to: number; zoneIdx: number; }
type RowAssignment = number | { splits: RowSplit[] };

interface ZoneForm {
  zone_name: string; zone_type: 'ga' | 'reserved'; price: number; original_price: number;
  total_capacity: number; color: string; has_2x1: boolean; venue_section_ids: string[];
}
interface ScheduleForm {
  date: string; start_time: string; end_time: string; total_capacity: number;
  staff_pin: string; staff_phone: string; staff_email: string;
}
interface EventForm {
  name: string; slug: string; venue_id: string; category: string;
  description: string; long_description: string; quote: string;
  image_url: string; poster_url: string; card_url: string;
  seo_title: string; seo_description: string;
  show_remaining: boolean; featured: boolean; sort_order: number;
}

interface Props { open: boolean; onClose: () => void; onCreated: () => void; }

/* ─── Helpers ─── */
function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function rPin(): string { return String(Math.floor(100000 + Math.random() * 900000)); }

async function proxyFetch<T>(path: string, query?: string): Promise<T> {
  const params = new URLSearchParams();
  params.set('path', path);
  if (query) {
    const qs = new URLSearchParams(query);
    qs.forEach((v, k) => params.set(k, v));
  }
  const res = await fetch(`/api/supabase-proxy?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  return res.json();
}

/* ─── Styles ─── */
const inpCls = 'w-full rounded-lg border border-gray-700 bg-[#1a1a1a] px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#EF4444] focus:outline-none transition-colors';
const noSpinCls = '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]';
const lblCls = 'block text-xs text-gray-400 mb-1';
const cardCls = 'bg-[#111] rounded-xl p-4 border border-gray-800';

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function EventWizard({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  // Venues
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueSections, setVenueSections] = useState<VenueSection[]>([]);

  // Step 1: Event Info
  const [ev, setEv] = useState<EventForm>({
    name: '', slug: '', venue_id: '', category: 'teatro',
    description: '', long_description: '', quote: '',
    image_url: '', poster_url: '', card_url: '',
    seo_title: '', seo_description: '',
    show_remaining: false, featured: false, sort_order: 0,
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [seoTitleEdited, setSeoTitleEdited] = useState(false);
  const [seoDescEdited, setSeoDescEdited] = useState(false);

  // Step 2: Schedules
  const [schedules, setSchedules] = useState<ScheduleForm[]>([
    { date: '', start_time: '20:00', end_time: '21:30', total_capacity: 0, staff_pin: rPin(), staff_phone: '', staff_email: '' },
  ]);
  const [durationMin, setDurationMin] = useState(90);

  // Recurring helper
  const [showRecHelper, setShowRecHelper] = useState(false);
  const [recDay, setRecDay] = useState(6); // Saturday
  const [recTime, setRecTime] = useState('20:00');
  const [recFrom, setRecFrom] = useState('');
  const [recTo, setRecTo] = useState('');

  // Step 3: Zones
  const [zones, setZones] = useState<ZoneForm[]>([
    { zone_name: 'General', zone_type: 'ga', price: 0, original_price: 0, total_capacity: 100, color: ZONE_COLORS[0], has_2x1: false, venue_section_ids: [] },
  ]);

  // Seat Mapper (Mapeo step)
  const [venueSeats, setVenueSeats] = useState<VenueSeatWizard[]>([]);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [seatAssignments, setSeatAssignments] = useState<Map<string, RowAssignment>>(new Map()); // rowKey → zone index or splits
  const [activeMapZone, setActiveMapZone] = useState(0);

  // Organizer & Commission
  const [orgName, setOrgName] = useState('');
  const [orgPhone, setOrgPhone] = useState('5573933510');
  const [orgEmail, setOrgEmail] = useState('paolo@dulos.io');
  const [commRate, setCommRate] = useState(15);

  // Selected venue
  const selVenue = useMemo(() => venues.find(v => v.id === ev.venue_id) || null, [venues, ev.venue_id]);
  const hasReservedSections = useMemo(() => venueSections.some(s => s.section_type === 'reserved'), [venueSections]);
  const venueBadge = useMemo(() => {
    if (!selVenue) return '';
    if (hasReservedSections) {
      const hasGA = venueSections.some(s => s.section_type === 'ga') || venueSections.length === 0;
      return hasGA ? 'Mixto' : 'Reserved';
    }
    return 'GA';
  }, [selVenue, hasReservedSections, venueSections]);

  // ─── Dynamic steps ───
  const hasReservedZones = useMemo(() => zones.some(z => z.zone_type === 'reserved'), [zones]);
  const stepLabels = useMemo(() => hasReservedZones ? STEP_LABELS_6 : STEP_LABELS_5, [hasReservedZones]);
  const totalSteps = stepLabels.length;
  // Map logical step names to step numbers
  const stepMap = useMemo(() => {
    const m: Record<string, number> = {};
    stepLabels.forEach((label, i) => { m[label] = i + 1; });
    return m;
  }, [stepLabels]);
  const STEP_INFO = 1;
  const STEP_FECHAS = 2;
  const STEP_ZONAS = 3;
  const stepMapeo = hasReservedZones ? 4 : -1;
  const stepOrganizador = hasReservedZones ? 5 : 4;
  const stepRevision = hasReservedZones ? 6 : 5;

  // ─── Seat mapper helpers ───
  const reservedZoneIndices = useMemo(() =>
    zones.map((z, i) => ({ zone: z, index: i })).filter(({ zone }) => zone.zone_type === 'reserved'),
    [zones]
  );

  function rowKeyW(section: string, rowLabel: string): string {
    return `${section}::${rowLabel}`;
  }

  function groupSeatsByRowW(seats: VenueSeatWizard[]): RowGroup[] {
    const rowMap = new Map<string, RowGroup>();
    for (const seat of seats) {
      const key = rowKeyW(seat.section, seat.row_label);
      if (!rowMap.has(key)) {
        rowMap.set(key, { label: seat.row_label, section: seat.section, seatCount: 0, seatIds: [], minSeat: seat.seat_number, maxSeat: seat.seat_number });
      }
      const row = rowMap.get(key)!;
      row.seatCount++;
      row.seatIds.push(seat.id);
      if (seat.seat_number < row.minSeat) row.minSeat = seat.seat_number;
      if (seat.seat_number > row.maxSeat) row.maxSeat = seat.seat_number;
    }
    return Array.from(rowMap.values()).sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.label.localeCompare(b.label);
    });
  }

  const seatRows = useMemo(() => groupSeatsByRowW(venueSeats), [venueSeats]);

  // Group rows by section for display
  const seatRowsBySection = useMemo(() => {
    const map = new Map<string, RowGroup[]>();
    for (const row of seatRows) {
      if (!map.has(row.section)) map.set(row.section, []);
      map.get(row.section)!.push(row);
    }
    return map;
  }, [seatRows]);

  // Compute seat counts per zone from assignments (handles whole-row and splits)
  const zoneSeatCounts = useMemo(() => {
    const counts = new Map<number, number>(); // zone index → seat count
    for (const row of seatRows) {
      const key = rowKeyW(row.section, row.label);
      const assignment = seatAssignments.get(key);
      if (assignment === undefined) continue;
      if (typeof assignment === 'number') {
        counts.set(assignment, (counts.get(assignment) || 0) + row.seatCount);
      } else {
        for (const split of assignment.splits) {
          const seatCount = split.to - split.from + 1;
          counts.set(split.zoneIdx, (counts.get(split.zoneIdx) || 0) + seatCount);
        }
      }
    }
    return counts;
  }, [seatRows, seatAssignments]);

  const unassignedSeatCount = useMemo(() => {
    return seatRows.reduce((sum, row) => {
      const key = rowKeyW(row.section, row.label);
      const assignment = seatAssignments.get(key);
      if (assignment === undefined) return sum + row.seatCount;
      if (typeof assignment === 'number') return sum;
      // For splits: check coverage
      const totalCovered = assignment.splits.reduce((s, sp) => s + (sp.to - sp.from + 1), 0);
      return sum + Math.max(0, row.seatCount - totalCovered);
    }, 0);
  }, [seatRows, seatAssignments]);

  // Toggle row assignment (whole-row only — split rows use separate handlers)
  const toggleRowAssignment = useCallback((row: RowGroup) => {
    const key = rowKeyW(row.section, row.label);
    setSeatAssignments(prev => {
      const next = new Map(prev);
      const activeIdx = reservedZoneIndices[activeMapZone]?.index;
      if (activeIdx === undefined) return prev;
      const current = next.get(key);
      // Don't toggle if row is in split mode — user must undo split first
      if (current !== undefined && typeof current !== 'number') return prev;
      if (current === activeIdx) {
        next.delete(key);
      } else {
        next.set(key, activeIdx);
      }
      return next;
    });
  }, [activeMapZone, reservedZoneIndices]);

  // Enter split mode for a row — auto-assign alternating zones for 2-zone venues
  const enterSplitMode = useCallback((row: RowGroup) => {
    const key = rowKeyW(row.section, row.label);
    const activeIdx = reservedZoneIndices[activeMapZone]?.index ?? 0;
    // For 2 reserved zones: auto-create 2 ranges with alternating zones
    if (reservedZoneIndices.length === 2) {
      const otherIdx = reservedZoneIndices.find((_, i) => i !== activeMapZone)?.index ?? activeIdx;
      const mid = Math.floor((row.minSeat + row.maxSeat) / 2);
      setSeatAssignments(prev => {
        const next = new Map(prev);
        next.set(key, { splits: [
          { from: row.minSeat, to: mid, zoneIdx: activeIdx },
          { from: mid + 1, to: row.maxSeat, zoneIdx: otherIdx },
        ]});
        return next;
      });
    } else {
      setSeatAssignments(prev => {
        const next = new Map(prev);
        next.set(key, { splits: [{ from: row.minSeat, to: row.maxSeat, zoneIdx: activeIdx }] });
        return next;
      });
    }
  }, [activeMapZone, reservedZoneIndices]);

  // Exit split mode (revert to unassigned)
  const exitSplitMode = useCallback((row: RowGroup) => {
    const key = rowKeyW(row.section, row.label);
    setSeatAssignments(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // Add a split point (divide largest range in half)
  const addSplitPoint = useCallback((row: RowGroup) => {
    const key = rowKeyW(row.section, row.label);
    setSeatAssignments(prev => {
      const next = new Map(prev);
      const assignment = next.get(key);
      if (!assignment || typeof assignment === 'number') return prev;
      const splits = [...assignment.splits];
      // Find largest range
      let largestIdx = 0;
      let largestSize = 0;
      splits.forEach((sp, i) => {
        const size = sp.to - sp.from + 1;
        if (size > largestSize) { largestSize = size; largestIdx = i; }
      });
      if (largestSize < 2) return prev; // Can't split a 1-seat range
      const sp = splits[largestIdx];
      const mid = Math.floor((sp.from + sp.to) / 2);
      // New range gets the "other" zone (for 2-zone: alternate; for 3+: use active)
      let newZoneIdx = reservedZoneIndices[activeMapZone]?.index ?? 0;
      if (reservedZoneIndices.length === 2) {
        // Pick the zone that ISN'T the one in the split being divided
        const otherZone = reservedZoneIndices.find(rz => rz.index !== sp.zoneIdx);
        if (otherZone) newZoneIdx = otherZone.index;
      }
      const newSplits = [
        ...splits.slice(0, largestIdx),
        { from: sp.from, to: mid, zoneIdx: sp.zoneIdx },
        { from: mid + 1, to: sp.to, zoneIdx: newZoneIdx },
        ...splits.slice(largestIdx + 1),
      ];
      next.set(key, { splits: newSplits });
      return next;
    });
  }, [activeMapZone, reservedZoneIndices]);

  // Remove a split range by index (merges with previous range)
  const removeSplitRange = useCallback((row: RowGroup, splitIdx: number) => {
    const key = rowKeyW(row.section, row.label);
    setSeatAssignments(prev => {
      const next = new Map(prev);
      const assignment = next.get(key);
      if (!assignment || typeof assignment === 'number') return prev;
      const splits = [...assignment.splits];
      if (splits.length <= 1) return prev; // Can't remove last range
      // Merge with adjacent range (prefer previous, fallback to next)
      const mergeIdx = splitIdx > 0 ? splitIdx - 1 : 0;
      const mergeWith = splitIdx > 0 ? splits[splitIdx - 1] : splits[splitIdx + 1];
      const current = splits[splitIdx];
      const merged = { from: Math.min(mergeWith.from, current.from), to: Math.max(mergeWith.to, current.to), zoneIdx: mergeWith.zoneIdx };
      const targetIdx = splitIdx > 0 ? splitIdx - 1 : splitIdx + 1;
      const newSplits = splits.filter((_, i) => i !== splitIdx && i !== targetIdx);
      newSplits.splice(Math.min(splitIdx, targetIdx), 0, merged);
      next.set(key, { splits: newSplits.sort((a, b) => a.from - b.from) });
      return next;
    });
  }, []);

  // Update zone for a specific split range
  const updateSplitZone = useCallback((row: RowGroup, splitIdx: number, zoneIdx: number) => {
    const key = rowKeyW(row.section, row.label);
    setSeatAssignments(prev => {
      const next = new Map(prev);
      const assignment = next.get(key);
      if (!assignment || typeof assignment === 'number') return prev;
      const splits = assignment.splits.map((sp, i) => i === splitIdx ? { ...sp, zoneIdx } : sp);
      next.set(key, { splits });
      return next;
    });
  }, []);

  // Update the END boundary of range at splitIdx → cascade-adjust start of next range
  const updateSplitTo = useCallback((row: RowGroup, splitIdx: number, newTo: number) => {
    const key = rowKeyW(row.section, row.label);
    setSeatAssignments(prev => {
      const next = new Map(prev);
      const assignment = next.get(key);
      if (!assignment || typeof assignment === 'number') return prev;
      const splits = [...assignment.splits];
      // Only clamp to row bounds — no artificial intermediate limits
      const clampedTo = Math.max(splits[splitIdx].from, Math.min(row.maxSeat, newTo));
      splits[splitIdx] = { ...splits[splitIdx], to: clampedTo };
      // Cascade: recompute from of each subsequent range, last range always ends at maxSeat
      for (let i = splitIdx + 1; i < splits.length; i++) {
        const newFrom = splits[i - 1].to + 1;
        const newRangeTo = i === splits.length - 1 ? row.maxSeat : Math.max(newFrom, splits[i].to);
        splits[i] = { ...splits[i], from: newFrom, to: newRangeTo };
      }
      next.set(key, { splits });
      return next;
    });
  }, []);

  // Auto-update zone capacities when seat assignments change
  useEffect(() => {
    if (!hasReservedZones || seatRows.length === 0) return;
    setZones(prev => {
      let changed = false;
      const updated = prev.map((z, i) => {
        if (z.zone_type !== 'reserved') return z;
        const newCap = zoneSeatCounts.get(i) || 0;
        if (z.total_capacity !== newCap) {
          changed = true;
          return { ...z, total_capacity: newCap };
        }
        return z;
      });
      return changed ? updated : prev;
    });
  }, [zoneSeatCounts, hasReservedZones, seatRows.length]);

  // ─── Fetch venue seats when mapeo step is reached ───
  useEffect(() => {
    if (step !== stepMapeo || !ev.venue_id || venueSeats.length > 0) return;
    setSeatsLoading(true);
    proxyFetch<VenueSeatWizard[]>('venue_seats', `venue_id=eq.${ev.venue_id}&order=sort_order.asc`)
      .then(seats => {
        setVenueSeats(seats);
        // Default active zone to first reserved zone
        if (reservedZoneIndices.length > 0) setActiveMapZone(0);
      })
      .catch(() => toast.error('Error cargando asientos del venue'))
      .finally(() => setSeatsLoading(false));
  }, [step, stepMapeo, ev.venue_id, venueSeats.length, reservedZoneIndices.length]);

  // ─── Load venues ───
  useEffect(() => {
    if (!open) return;
    proxyFetch<Venue[]>('venues', 'order=name.asc').then(setVenues).catch(() => setVenues([]));
  }, [open]);

  // ─── Load venue sections when venue changes ───
  useEffect(() => {
    if (!ev.venue_id) { setVenueSections([]); return; }
    proxyFetch<VenueSection[]>('venue_sections', `venue_id=eq.${ev.venue_id}&order=sort_order.asc`)
      .then(setVenueSections)
      .catch(() => setVenueSections([]));
    // Reset seat mapper state on venue change
    setVenueSeats([]); setSeatAssignments(new Map<string, RowAssignment>()); setActiveMapZone(0);
  }, [ev.venue_id]);

  // ─── Auto-slug from name + venue ───
  useEffect(() => {
    if (slugEdited || !ev.name) return;
    const venueSlug = selVenue?.slug || '';
    const base = slugify(ev.name);
    const full = venueSlug ? `${base}-${venueSlug}` : base;
    setEv(p => ({ ...p, slug: full }));
  }, [ev.name, selVenue, slugEdited]);

  // ─── Auto SEO ───
  useEffect(() => {
    if (!seoTitleEdited && ev.name) {
      const venue = selVenue?.name || '';
      const city = selVenue?.city || '';
      setEv(p => ({ ...p, seo_title: `${p.name}${venue ? ` | ${venue}` : ''}${city ? ` ${city}` : ''} | Boletos sin comisiones` }));
    }
  }, [ev.name, selVenue, seoTitleEdited]);

  useEffect(() => {
    if (!seoDescEdited && ev.description) {
      setEv(p => ({ ...p, seo_description: p.description.slice(0, 160) }));
    }
  }, [ev.description, seoDescEdited]);

  // ─── Auto end_time from duration ───
  useEffect(() => {
    if (!durationMin) return;
    setSchedules(prev => prev.map(s => {
      if (!s.start_time) return s;
      const [h, m] = s.start_time.split(':').map(Number);
      const total = h * 60 + m + durationMin;
      const eh = Math.floor(total / 60) % 24;
      const em = total % 60;
      return { ...s, end_time: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}` };
    }));
  }, [durationMin]);

  // ─── Auto capacity from zones ───
  const totalZoneCapacity = useMemo(() => zones.reduce((s, z) => s + (z.total_capacity || 0), 0), [zones]);

  // ─── Reset on close ───
  useEffect(() => {
    if (open) return;
    setStep(1); setError(''); setWarnings([]); setSubmitting(false); setSlugEdited(false);
    setSeoTitleEdited(false); setSeoDescEdited(false);
    setEv({ name: '', slug: '', venue_id: '', category: 'teatro', description: '', long_description: '', quote: '', image_url: '', poster_url: '', card_url: '', seo_title: '', seo_description: '', show_remaining: false, featured: false, sort_order: 0 });
    setZones([{ zone_name: 'General', zone_type: 'ga', price: 0, original_price: 0, total_capacity: 100, color: ZONE_COLORS[0], has_2x1: false, venue_section_ids: [] }]);
    setSchedules([{ date: '', start_time: '20:00', end_time: '21:30', total_capacity: 0, staff_pin: rPin(), staff_phone: '', staff_email: '' }]);
    setCommRate(15); setDurationMin(90); setShowRecHelper(false);
    setOrgName(''); setOrgPhone('5573933510'); setOrgEmail('paolo@dulos.io');
    setVenueSeats([]); setSeatAssignments(new Map()); setActiveMapZone(0); setSeatsLoading(false);
  }, [open]);

  // ─── Generate recurring schedules ───
  const generateRecurring = () => {
    if (!recFrom || !recTo) return;
    const start = new Date(recFrom + 'T12:00:00');
    const end = new Date(recTo + 'T12:00:00');
    const newSchedules: ScheduleForm[] = [];
    const d = new Date(start);
    while (d <= end) {
      if (d.getDay() === recDay) {
        const dateStr = d.toISOString().split('T')[0];
        const [h, m] = recTime.split(':').map(Number);
        const total = h * 60 + m + durationMin;
        const eh = Math.floor(total / 60) % 24;
        const em = total % 60;
        newSchedules.push({
          date: dateStr,
          start_time: recTime,
          end_time: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
          total_capacity: 0,
          staff_pin: rPin(),
          staff_phone: '',
          staff_email: '',
        });
      }
      d.setDate(d.getDate() + 1);
    }
    if (newSchedules.length > 0) {
      setSchedules(newSchedules);
      setShowRecHelper(false);
      toast.success(`${newSchedules.length} fechas generadas`);
    } else {
      toast.error('No se encontraron fechas para el día seleccionado');
    }
  };

  // ─── Validation ───
  function canNext(): boolean {
    if (step === STEP_INFO) return !!(ev.name && ev.venue_id && ev.slug);
    if (step === STEP_FECHAS) return schedules.length > 0 && schedules.every(s => s.date && s.start_time);
    if (step === STEP_ZONAS) return zones.length > 0 && zones.every(z =>
      z.zone_name && z.price > 0 && (z.zone_type === 'reserved' || z.total_capacity > 0)
      && (venueSections.length === 0 || z.venue_section_ids.length > 0) // require section when venue has sections
    );
    if (step === stepMapeo) return unassignedSeatCount === 0 && seatRows.length > 0;
    if (step === stepOrganizador) return !!(orgName && orgPhone && orgEmail);
    return true;
  }

  // ─── Compute warnings ───
  const computeWarnings = useCallback((): string[] => {
    const w: string[] = [];
    if (selVenue && !selVenue.layout_svg_url) w.push('El venue no tiene SVG — el evento no mostrará mapa del venue');
    if (!ev.image_url) w.push('Sin imagen principal — el card del evento se verá vacío');
    for (const z of zones) {
      if (z.price > 0 && !z.original_price) {
        // Not necessarily a warning
      }
    }
    const totalGA = zones.filter(z => z.zone_type === 'ga').reduce((s, z) => s + z.total_capacity, 0);
    if (selVenue && totalGA > selVenue.capacity) w.push(`Capacidad GA (${totalGA}) excede capacidad del venue (${selVenue.capacity})`);
    return w;
  }, [ev, zones, selVenue]);

  // ─── Submit ───
  async function handleSubmit(status: 'draft' | 'active') {
    setSubmitting(true); setError('');
    try {
      const payload = {
        name: ev.name,
        slug: ev.slug,
        venue_id: ev.venue_id,
        category: ev.category,
        description: ev.description,
        long_description: ev.long_description,
        quote: ev.quote,
        image_url: ev.image_url,
        poster_url: ev.poster_url,
        card_url: ev.card_url,
        seo_title: ev.seo_title,
        seo_description: ev.seo_description,
        show_remaining: ev.show_remaining,
        featured: ev.featured,
        sort_order: ev.sort_order,
        status,
        zones: zones.map(z => ({
          zone_name: z.zone_name,
          zone_type: z.zone_type,
          price: z.price,
          original_price: z.original_price || null,
          total_capacity: z.total_capacity,
          color: z.color,
          has_2x1: z.has_2x1,
          venue_section_ids: z.venue_section_ids.length > 0 ? z.venue_section_ids : undefined,
        })),
        schedules: schedules.map(s => ({
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time || null,
          total_capacity: s.total_capacity || totalZoneCapacity,
          staff_pin: s.staff_pin,
          staff_phone: orgPhone || '5573933510',
          staff_email: orgEmail || 'paolo@dulos.io',
        })),
        commission_rate: commRate / 100,
        venue_timezone: selVenue?.timezone || 'America/Mexico_City',
        // Seat assignments for reserved zones (rowKey → zone index or splits)
        ...(hasReservedZones && seatAssignments.size > 0 ? {
          seat_assignments: Object.fromEntries(seatAssignments),
        } : {}),
      };

      const res = await fetch('/api/admin/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear evento');

      toast.success(`✅ Evento creado: ${data.summary.zones} zonas, ${data.summary.schedules} fechas, ${data.summary.inventory_rows} inventario`);
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Error al crear evento');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  /* ─── Shared UI helpers ─── */
  const XBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="absolute right-3 top-3 text-gray-600 hover:text-red-400 transition-colors" title="Eliminar">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  );

  const stepWarnings = step === stepRevision ? computeWarnings() : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0a0a0a] border border-gray-800 shadow-2xl">
        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-500 hover:text-white transition-colors z-10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        {/* Step indicator */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-bold text-white mb-4">Crear Evento</h2>
          <div className="flex items-center gap-1 mb-2">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              const active = n === step;
              const done = n < step;
              return (
                <div key={n} className="flex items-center gap-1.5 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${active ? 'bg-[#EF4444] text-white' : done ? 'bg-[#EF4444]/30 text-[#EF4444]' : 'bg-gray-800 text-gray-500'}`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`text-xs hidden sm:inline ${active ? 'text-white font-medium' : 'text-gray-500'}`}>{label}</span>
                  {i < stepLabels.length - 1 && <div className={`flex-1 h-px mx-1 ${done ? 'bg-[#EF4444]/40' : 'bg-gray-800'}`}/>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-6">

          {/* ═══ STEP 1: EVENT INFO ═══ */}
          {step === STEP_INFO && (
            <div className="space-y-4">
              <div><label className={lblCls}>Nombre del evento *</label><input className={inpCls} value={ev.name} onChange={e => setEv(p => ({ ...p, name: e.target.value }))} placeholder="Archivo Confidencial: CÁMARA BLANCA"/></div>

              <div>
                <label className={lblCls}>Venue *</label>
                <select value={ev.venue_id} onChange={e => setEv(p => ({ ...p, venue_id: e.target.value }))} className={inpCls}>
                  <option value="">— Seleccionar venue —</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}
                </select>
              </div>

              {/* Venue preview */}
              {selVenue && (
                <div className={cardCls}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{selVenue.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{[selVenue.address, selVenue.city, selVenue.state].filter(Boolean).join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${venueBadge === 'GA' ? 'bg-green-900/50 text-green-400' : venueBadge === 'Reserved' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'}`}>
                        {venueBadge}
                      </span>
                      <span className="text-xs text-gray-500">{selVenue.capacity} cap</span>
                    </div>
                  </div>
                  {selVenue.layout_svg_url && (
                    <div className="mt-3 h-20 bg-[#0a0a0a] rounded overflow-hidden flex items-center justify-center">
                      <img src={selVenue.layout_svg_url} alt="Mapa" className="max-h-full opacity-60"/>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className={lblCls}>Slug (auto)</label>
                <input className={`${inpCls} opacity-60 cursor-not-allowed`} value={ev.slug} readOnly tabIndex={-1}/>
                <p className="text-[10px] text-gray-600 mt-1">Auto-generado: nombre-venue-ciudad</p>
              </div>

              <div>
                <label className={lblCls}>Categoría *</label>
                <select className={inpCls} value={ev.category} onChange={e => setEv(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>

              <div><label className={lblCls}>Descripción corta</label><textarea className={`${inpCls} min-h-[60px] resize-y`} value={ev.description} onChange={e => setEv(p => ({ ...p, description: e.target.value }))} placeholder="Para el card del evento..."/></div>

              <div><label className={lblCls}>Descripción larga</label><textarea className={`${inpCls} min-h-[80px] resize-y`} value={ev.long_description} onChange={e => setEv(p => ({ ...p, long_description: e.target.value }))} placeholder="Para la página del evento..."/></div>

              <div><label className={lblCls}>Quote</label><input className={inpCls} value={ev.quote} onChange={e => setEv(p => ({ ...p, quote: e.target.value }))} placeholder="Frase destacada..."/></div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className={lblCls}>Imagen principal (URL)</label><input className={inpCls} value={ev.image_url} onChange={e => setEv(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..."/></div>
                <div><label className={lblCls}>Poster (URL)</label><input className={inpCls} value={ev.poster_url} onChange={e => setEv(p => ({ ...p, poster_url: e.target.value }))} placeholder="Vertical, redes"/></div>
                <div><label className={lblCls}>Card (URL)</label><input className={inpCls} value={ev.card_url} onChange={e => setEv(p => ({ ...p, card_url: e.target.value }))} placeholder="Horizontal, preview"/></div>
              </div>

              {/* SEO — collapsible */}
              <details className="group">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">SEO (auto-generado) ▸</summary>
                <div className="mt-3 space-y-3">
                  <div><label className={lblCls}>SEO Title (auto)</label><input className={`${inpCls} opacity-60 cursor-not-allowed`} value={ev.seo_title} readOnly tabIndex={-1}/></div>
                  <div><label className={lblCls}>SEO Description</label><textarea className={`${inpCls} min-h-[50px] resize-y`} value={ev.seo_description} onChange={e => { setSeoDescEdited(true); setEv(p => ({ ...p, seo_description: e.target.value })); }}/></div>
                </div>
              </details>
            </div>
          )}

          {/* ═══ STEP 2: SCHEDULES ═══ */}
          {step === STEP_FECHAS && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className={lblCls + ' mb-0'}>Duración (min)</label>
                  <input type="number" className={`${inpCls} ${noSpinCls} w-20`} value={durationMin} onChange={e => setDurationMin(Number(e.target.value))} min={15} step={15}/>
                </div>
                <button onClick={() => setShowRecHelper(!showRecHelper)} className="text-xs text-[#EF4444] hover:text-red-300 transition-colors">
                  {showRecHelper ? 'Cerrar' : '🔄 Generar fechas recurrentes'}
                </button>
              </div>

              {/* Recurring helper */}
              {showRecHelper && (
                <div className={`${cardCls} space-y-3`}>
                  <p className="text-xs font-medium text-white">Generar fechas recurrentes</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className={lblCls}>Día</label>
                      <select className={inpCls} value={recDay} onChange={e => setRecDay(Number(e.target.value))}>
                        {DAYS_ES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>
                    <div><label className={lblCls}>Hora</label><input type="time" className={`${inpCls} ${noSpinCls}`} value={recTime} onChange={e => setRecTime(e.target.value)}/></div>
                    <div><label className={lblCls}>Desde</label><input type="date" className={inpCls} value={recFrom} onChange={e => setRecFrom(e.target.value)}/></div>
                    <div><label className={lblCls}>Hasta</label><input type="date" className={inpCls} value={recTo} onChange={e => setRecTo(e.target.value)}/></div>
                  </div>
                  <button onClick={generateRecurring} className="text-xs bg-[#EF4444] text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                    Generar
                  </button>
                </div>
              )}

              {/* Schedule list */}
              {schedules.map((s, i) => (
                <div key={i} className={`${cardCls} relative`}>
                  {schedules.length > 1 && <XBtn onClick={() => setSchedules(ss => ss.filter((_, j) => j !== i))}/>}
                  <p className="text-xs text-gray-500 font-medium mb-3">
                    Fecha {i + 1}
                    {s.date && <span className="text-gray-600 ml-2">· {DAYS_ES[new Date(s.date + 'T12:00').getDay()]}</span>}
                    <span className="text-gray-600 ml-2">· PIN: {s.staff_pin}</span>
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={lblCls}>Fecha *</label><input type="date" className={inpCls} value={s.date} onChange={e => setSchedules(ss => ss.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}/></div>
                    <div><label className={lblCls}>Hora inicio *</label><input type="time" className={`${inpCls} ${noSpinCls}`} value={s.start_time} onChange={e => { const v = e.target.value; setSchedules(ss => ss.map((x, j) => { if (j !== i) return x; const [h, m] = v.split(':').map(Number); const total = h * 60 + m + durationMin; const eh = Math.floor(total / 60) % 24; const em = total % 60; return { ...x, start_time: v, end_time: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}` }; })); }}/></div>
                    <div><label className={lblCls}>Hora fin</label><input type="time" className={`${inpCls} ${noSpinCls} text-gray-400 cursor-default`} value={s.end_time} readOnly tabIndex={-1}/></div>
                  </div>
                </div>
              ))}
              <button onClick={() => { const dur = durationMin || 90; setSchedules(ss => [...ss, { date: '', start_time: '20:00', end_time: `${String(Math.floor((20 * 60 + dur) / 60) % 24).padStart(2, '0')}:${String((20 * 60 + dur) % 60).padStart(2, '0')}`, total_capacity: 0, staff_pin: rPin(), staff_phone: '', staff_email: '' }]); }} className="w-full py-2.5 rounded-lg border border-dashed border-gray-700 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors">+ Agregar fecha</button>
            </div>
          )}

          {/* ═══ STEP 3: ZONES ═══ */}
          {step === STEP_ZONAS && (
            <div className="space-y-4">
              {!hasReservedSections && (
                <div className="text-xs text-gray-500 bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-800">
                  Este venue solo admite zonas de <b className="text-gray-300">Admisión General</b>. Para zonas con asientos numerados, primero agrega secciones de tipo &quot;reserved&quot; al venue.
                </div>
              )}
              {zones.map((z, i) => (
                <div key={i} className={`${cardCls} relative`}>
                  {zones.length > 1 && <XBtn onClick={() => setZones(zs => zs.filter((_, j) => j !== i))}/>}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }}/>
                    <p className="text-xs text-gray-500 font-medium">Zona {i + 1}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className={lblCls}>Nombre *</label><input className={inpCls} value={z.zone_name} onChange={e => setZones(zs => zs.map((x, j) => j === i ? { ...x, zone_name: e.target.value } : x))} placeholder="VIP, General..."/></div>
                    {hasReservedSections && (
                      <div>
                        <label className={lblCls}>Tipo</label>
                        <select className={inpCls} value={z.zone_type} onChange={e => setZones(zs => zs.map((x, j) => j === i ? { ...x, zone_type: e.target.value as 'ga' | 'reserved' } : x))}>
                          <option value="ga">General (GA)</option>
                          <option value="reserved">Reserved</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {/* ─── Venue Sections Selector ─── */}
                  {venueSections.length > 0 && (() => {
                    // Compute which sections are assigned to OTHER zones
                    const assignedByOther = new Map<string, string>();
                    zones.forEach((oz, oi) => {
                      if (oi === i) return;
                      oz.venue_section_ids.forEach(sid => assignedByOther.set(sid, oz.zone_name || `Zona ${oi + 1}`));
                    });
                    // Show ALL venue sections — they represent physical areas regardless of zone type
                    const matchingSections = venueSections;
                    if (matchingSections.length === 0) return null;
                    return (
                      <div className="mb-3">
                        <label className={lblCls}>Secciones del venue</label>
                        <div className="space-y-1.5 mt-1">
                          {matchingSections.map(vs => {
                            const isAssigned = assignedByOther.has(vs.id);
                            const isChecked = z.venue_section_ids.includes(vs.id);
                            return (
                              <label key={vs.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                                isAssigned ? 'border-gray-800 bg-gray-900/30 text-gray-600 cursor-not-allowed' :
                                isChecked ? 'border-gray-600 bg-gray-800/50 text-white' :
                                'border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700'
                              }`}>
                                <input type="checkbox" className="accent-red-500 w-3.5 h-3.5"
                                  checked={isChecked} disabled={isAssigned}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    setZones(zs => zs.map((x, j) => {
                                      if (j !== i) return x;
                                      const newIds = checked
                                        ? [...x.venue_section_ids, vs.id]
                                        : x.venue_section_ids.filter(id => id !== vs.id);
                                      // Auto-compute capacity from selected sections
                                      const newCap = newIds.reduce((sum, sid) => {
                                        const sec = venueSections.find(s => s.id === sid);
                                        return sum + (sec?.capacity || 0);
                                      }, 0);
                                      return { ...x, venue_section_ids: newIds, total_capacity: newCap || x.total_capacity };
                                    }));
                                  }}
                                />
                                <span>{vs.name}</span>
                                <span className="text-gray-600 ml-auto">{vs.capacity} asientos</span>
                                {isAssigned && <span className="text-gray-600 text-[10px]">(→ {assignedByOther.get(vs.id)})</span>}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div><label className={lblCls}>Precio *</label><input type="number" className={`${inpCls} ${noSpinCls}`} value={z.price || ''} min={0} onChange={e => setZones(zs => zs.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))}/></div>
                    <div><label className={lblCls}>Precio original</label><input type="number" className={`${inpCls} ${noSpinCls}`} value={z.original_price || ''} min={0} placeholder="Tachado" onChange={e => setZones(zs => zs.map((x, j) => j === i ? { ...x, original_price: Number(e.target.value) } : x))}/></div>
                    <div>
                      <label className={lblCls}>Capacidad {z.venue_section_ids.length > 0 ? '(auto)' : z.zone_type === 'reserved' ? '(mapeo)' : '*'}</label>
                      <input type="number" className={`${inpCls} ${noSpinCls} ${z.venue_section_ids.length > 0 ? 'text-gray-400 cursor-default' : ''}`} value={z.total_capacity || ''} min={1}
                        readOnly={z.venue_section_ids.length > 0}
                        tabIndex={z.venue_section_ids.length > 0 ? -1 : undefined}
                        placeholder={z.venue_section_ids.length > 0 ? 'Suma de secciones' : z.zone_type === 'reserved' ? 'Se calcula del mapeo' : ''}
                        onChange={e => { if (z.venue_section_ids.length > 0) return; setZones(zs => zs.map((x, j) => j === i ? { ...x, total_capacity: Number(e.target.value) } : x)); }}/>
                    </div>
                    <div>
                      <label className={lblCls}>Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" value={z.color} onChange={e => setZones(zs => zs.map((x, j) => j === i ? { ...x, color: e.target.value } : x))}/>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setZones(zs => [...zs, { zone_name: '', zone_type: 'ga', price: 0, original_price: 0, total_capacity: 100, color: ZONE_COLORS[zs.length % ZONE_COLORS.length], has_2x1: false, venue_section_ids: [] }])} className="w-full py-2.5 rounded-lg border border-dashed border-gray-700 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors">+ Agregar zona</button>

              {/* Capacity check */}
              <div className="text-xs text-gray-500 flex justify-between px-1">
                <span>Total zonas: {totalZoneCapacity} boletos</span>
                {selVenue && <span className={totalZoneCapacity > selVenue.capacity ? 'text-red-400' : 'text-green-400'}>Venue: {selVenue.capacity} cap {totalZoneCapacity > selVenue.capacity ? '⚠️ excede' : '✓'}</span>}
              </div>
            </div>
          )}

          {/* ═══ STEP 4: MAPEO (only when reserved zones exist) ═══ */}
          {step === stepMapeo && stepMapeo > 0 && (
            <div className="space-y-4">
              <div className="text-xs text-gray-500 bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-800">
                Asigna cada fila de asientos a una zona reserved. Haz click en una fila para asignarla a la zona activa.
              </div>
              {seatsLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-8 bg-gray-800 rounded w-48" />
                  <div className="h-40 bg-gray-800 rounded" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left: Zone selector */}
                  <div className="space-y-3">
                    <div className={cardCls}>
                      <h3 className="text-sm font-semibold text-white mb-3">Zonas reserved</h3>
                      <div className="space-y-2">
                        {reservedZoneIndices.map(({ zone, index }, mapIdx) => {
                          const count = zoneSeatCounts.get(index) || 0;
                          const isActive = activeMapZone === mapIdx;
                          return (
                            <button
                              key={index}
                              onClick={() => setActiveMapZone(mapIdx)}
                              className={`w-full text-left px-3 py-3 rounded-lg border transition-all ${
                                isActive ? 'border-white bg-[#1a1a1a]' : 'border-gray-800 hover:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                                <span className="text-sm text-white font-medium">{zone.zone_name}</span>
                                <span className="text-xs text-gray-400 ml-auto">{fmt(zone.price)}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1 ml-5">
                                {count} asientos asignados
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {unassignedSeatCount > 0 && (
                        <div className="mt-3 px-3 py-2 bg-yellow-900/20 border border-yellow-800/30 rounded text-xs text-yellow-400">
                          ⚠️ {unassignedSeatCount} asientos sin asignar
                        </div>
                      )}
                      {unassignedSeatCount === 0 && seatRows.length > 0 && (
                        <div className="mt-3 px-3 py-2 bg-green-900/20 border border-green-800/30 rounded text-xs text-green-400">
                          ✓ Todos los asientos asignados
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Row list */}
                  <div className="lg:col-span-2">
                    <div className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-800">
                        <h3 className="text-sm font-semibold text-white">
                          Filas
                          <span className="text-gray-500 font-normal ml-2">
                            Click para asignar a{' '}
                            <span style={{ color: reservedZoneIndices[activeMapZone]?.zone.color || '#EF4444' }}>
                              {reservedZoneIndices[activeMapZone]?.zone.zone_name || '—'}
                            </span>
                          </span>
                        </h3>
                      </div>
                      <div className="max-h-[500px] overflow-y-auto">
                        {Array.from(seatRowsBySection.entries()).map(([sectionSlug, secRows]) => {
                          const secInfo = venueSections.find(vs => vs.slug === sectionSlug);
                          const totalSeats = secRows.reduce((s, r) => s + r.seatCount, 0);
                          return (
                            <div key={sectionSlug}>
                              <div className="px-4 py-2 bg-[#0d0d0d] text-xs text-gray-500 font-medium uppercase tracking-wider border-b border-gray-800/50">
                                {secInfo?.name || sectionSlug} · {totalSeats} asientos
                              </div>
                              {secRows.map(row => {
                                const key = rowKeyW(row.section, row.label);
                                const assignment = seatAssignments.get(key);
                                const isSplit = assignment !== undefined && typeof assignment !== 'number';
                                const wholeZoneIdx = typeof assignment === 'number' ? assignment : undefined;
                                const wholeZone = wholeZoneIdx !== undefined ? zones[wholeZoneIdx] : null;
                                const activeIdx = reservedZoneIndices[activeMapZone]?.index;
                                const isAssignedToActive = wholeZoneIdx === activeIdx;

                                if (isSplit && typeof assignment !== 'number') {
                                  // ── SPLIT MODE ──
                                  return (
                                    <div key={key} className="border-b border-gray-800/30 bg-[#0f0f0f]">
                                      {/* Split header */}
                                      <div className="px-4 py-2.5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="w-5 h-5 rounded border-2 border-purple-500 bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400">~</div>
                                          <span className="text-sm text-white font-mono font-bold">Fila {row.label}</span>
                                          <span className="text-xs text-purple-400">{row.seatCount} asientos · dividida</span>
                                        </div>
                                        <button
                                          onClick={() => exitSplitMode(row)}
                                          className="text-xs text-gray-500 hover:text-gray-200 transition-colors px-2 py-1 rounded"
                                          title="Deshacer división"
                                        >↩️ deshacer</button>
                                      </div>
                                      {/* Split ranges — editable boundaries */}
                                      <div className="px-4 pb-3 space-y-2">
                                        {assignment.splits.map((sp, spIdx) => {
                                          const spZone = zones[sp.zoneIdx];
                                          const isLastRange = spIdx === assignment.splits.length - 1;
                                          const show2ZoneLabel = reservedZoneIndices.length <= 2; // no dropdown for 2 zones
                                          return (
                                            <div key={spIdx} className="flex items-center gap-1.5 text-xs">
                                              {/* From — always read-only */}
                                              <span className="text-gray-500 flex-shrink-0">Asientos</span>
                                              <input
                                                type="number"
                                                readOnly
                                                value={sp.from}
                                                className={`w-12 rounded border border-gray-700 bg-[#222] px-1.5 py-1 text-xs text-gray-400 text-center ${noSpinCls}`}
                                                tabIndex={-1}
                                              />
                                              <span className="text-gray-600 flex-shrink-0">–</span>
                                              {/* To: editable unless last range */}
                                              {isLastRange ? (
                                                <input
                                                  type="number"
                                                  readOnly
                                                  value={sp.to}
                                                  className={`w-12 rounded border border-gray-700 bg-[#222] px-1.5 py-1 text-xs text-gray-400 text-center ${noSpinCls}`}
                                                  tabIndex={-1}
                                                />
                                              ) : (
                                                <input
                                                  type="number"
                                                  value={sp.to}
                                                  min={sp.from}
                                                  max={row.maxSeat}
                                                  onChange={e => updateSplitTo(row, spIdx, Number(e.target.value))}
                                                  onBlur={e => updateSplitTo(row, spIdx, Number(e.target.value))}
                                                  className={`w-12 rounded border border-[#EF4444]/60 bg-[#1a1a1a] px-1.5 py-1 text-xs text-white text-center focus:border-[#EF4444] focus:outline-none ${noSpinCls}`}
                                                />
                                              )}
                                              <span className="text-gray-600 flex-shrink-0">({Math.max(0, sp.to - sp.from + 1)})</span>
                                              {/* Zone: label for 2 zones, dropdown for 3+ */}
                                              {show2ZoneLabel ? (
                                                <span className="flex items-center gap-1 flex-1">
                                                  {spZone && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: spZone.color }} />}
                                                  <span style={{ color: spZone?.color || '#999' }}>{spZone?.zone_name || '—'}</span>
                                                </span>
                                              ) : (
                                                <select
                                                  className="flex-1 min-w-0 rounded border border-gray-700 bg-[#1a1a1a] px-2 py-1 text-xs text-white focus:border-[#EF4444] focus:outline-none"
                                                  value={sp.zoneIdx}
                                                  onChange={e => updateSplitZone(row, spIdx, Number(e.target.value))}
                                                >
                                                  {reservedZoneIndices.map(({ zone, index }) => (
                                                    <option key={index} value={index}>{zone.zone_name}</option>
                                                  ))}
                                                </select>
                                              )}
                                              {assignment.splits.length > 1 && (
                                                <button
                                                  onClick={() => removeSplitRange(row, spIdx)}
                                                  className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                                                  title="Eliminar rango"
                                                >✕</button>
                                              )}
                                            </div>
                                          );
                                        })}
                                        <button
                                          onClick={() => addSplitPoint(row)}
                                          className="text-xs text-gray-500 hover:text-white transition-colors mt-1"
                                        >+ Agregar división</button>
                                      </div>
                                    </div>
                                  );
                                }

                                // ── WHOLE ROW MODE ──
                                return (
                                  <div
                                    key={key}
                                    className={`group flex items-center justify-between border-b border-gray-800/30 transition-all hover:bg-[#1a1a1a] ${isAssignedToActive ? 'bg-[#1a1a1a]' : ''}`}
                                  >
                                    <button
                                      onClick={() => toggleRowAssignment(row)}
                                      className="flex-1 text-left px-4 py-2.5 flex items-center gap-3"
                                    >
                                      <div
                                        className="w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] transition-all flex-shrink-0"
                                        style={{
                                          borderColor: wholeZone?.color || '#555',
                                          backgroundColor: wholeZone ? wholeZone.color + '30' : 'transparent',
                                        }}
                                      >
                                        {wholeZone && '✓'}
                                      </div>
                                      <span className="text-sm text-white font-mono font-bold">Fila {row.label}</span>
                                      <span className="text-xs text-gray-500">{row.seatCount} asientos</span>
                                    </button>
                                    <div className="flex items-center gap-2 pr-3">
                                      {wholeZone ? (
                                        <span className="text-xs px-2 py-0.5 rounded-full" style={{
                                          backgroundColor: wholeZone.color + '20',
                                          color: wholeZone.color,
                                        }}>
                                          {wholeZone.zone_name}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-gray-600">sin asignar</span>
                                      )}
                                      <button
                                        onClick={e => { e.stopPropagation(); enterSplitMode(row); }}
                                        className="text-gray-600 hover:text-gray-200 transition-colors opacity-0 group-hover:opacity-100 text-sm px-1"
                                        title="Dividir fila por rangos"
                                      >✂️</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP: ORGANIZADOR ═══ */}
          {step === stepOrganizador && (
            <div className="space-y-4">
              <div className={cardCls}>
                <p className="text-xs text-gray-500 font-medium mb-3">Contacto del organizador</p>
                <div className="space-y-3">
                  <div><label className={lblCls}>Nombre / Productora *</label><input className={inpCls} value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Dulos Producciones"/></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lblCls}>Teléfono *</label><input className={inpCls} value={orgPhone} onChange={e => setOrgPhone(e.target.value)} placeholder="55 7393 3510"/></div>
                    <div><label className={lblCls}>Email *</label><input type="email" className={inpCls} value={orgEmail} onChange={e => setOrgEmail(e.target.value)} placeholder="paolo@dulos.io"/></div>
                  </div>
                </div>
              </div>

              <div className={cardCls}>
                <p className="text-xs text-gray-500 font-medium mb-3">Comisión Dulos</p>
                <div className="flex items-center gap-3">
                  <input type="number" className={`${inpCls} ${noSpinCls} w-24`} value={commRate} step={1} min={0} max={100} onChange={e => setCommRate(Number(e.target.value))}/>
                  <span className="text-sm text-gray-400">%</span>
                </div>
              </div>

              <div className={cardCls}>
                <p className="text-xs text-gray-500 font-medium mb-3">Configuración</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" className="accent-[#EF4444]" checked={ev.show_remaining} onChange={e => setEv(p => ({ ...p, show_remaining: e.target.checked }))}/>
                    Mostrar boletos restantes
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" className="accent-[#EF4444]" checked={ev.featured} onChange={e => setEv(p => ({ ...p, featured: e.target.checked }))}/>
                    Evento destacado
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-300">Orden</label>
                    <input type="number" className={`${inpCls} ${noSpinCls} w-20`} value={ev.sort_order} min={0} onChange={e => setEv(p => ({ ...p, sort_order: Number(e.target.value) }))}/>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP: REVIEW ═══ */}
          {step === stepRevision && (
            <div className="space-y-4">
              {/* Venue */}
              <div className={cardCls}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Venue</p>
                <p className="text-sm font-bold text-white">{selVenue?.name || '—'}</p>
                <p className="text-xs text-gray-400">{[selVenue?.address, selVenue?.city].filter(Boolean).join(', ')} · Cap: {selVenue?.capacity} · <span className={`${venueBadge === 'GA' ? 'text-green-400' : 'text-blue-400'}`}>{venueBadge}</span></p>
              </div>

              {/* Event */}
              <div className={cardCls}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Evento</p>
                <p className="text-sm font-bold text-white">{ev.name}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                  <span>/{ev.slug}</span>
                  <span>{schedules.length === 1 ? 'Única fecha' : `Recurrente (${schedules.length} fechas)`}</span>
                  <span>{ev.category}</span>
                  {ev.image_url && <span className="text-green-400">✓ Imagen</span>}
                </div>
              </div>

              {/* Zones */}
              <div className={cardCls}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Zonas ({zones.length})</p>
                <div className="space-y-1.5">
                  {zones.map((z, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }}/>
                        <span className="text-white">{z.zone_name}</span>
                        <span className="text-gray-600">({z.zone_type})</span>
                      </div>
                      <div className="text-gray-400 text-right">
                        {fmt(z.price)}
                        {z.original_price > 0 && <span className="line-through text-gray-600 ml-1">{fmt(z.original_price)}</span>}
                        <span className="ml-2">{z.total_capacity} bol.</span>
                        {z.venue_section_ids.length > 0 && (
                          <span className="ml-2 text-gray-600">
                            ({z.venue_section_ids.map(sid => venueSections.find(vs => vs.id === sid)?.name || '?').join(', ')})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedules */}
              <div className={cardCls}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Fechas ({schedules.length})</p>
                <div className="space-y-1">
                  {schedules.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-white">{fmtDateDay(s.date)}, {s.start_time}{s.end_time ? `–${s.end_time}` : ''}</span>
                      <span className="text-gray-400">Cap: {s.total_capacity || totalZoneCapacity} · PIN: {s.staff_pin}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* What will be created */}
              <div className={cardCls}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Se creará</p>
                <div className="space-y-1 text-xs text-gray-300">
                  <p>✓ 1 evento ({schedules.length === 1 ? 'única fecha' : 'recurrente'})</p>
                  <p>✓ {zones.length} zona{zones.length > 1 ? 's' : ''} de boletos</p>
                  <p>✓ {schedules.length} fecha{schedules.length > 1 ? 's' : ''}</p>
                  <p>✓ {schedules.length * zones.length} registros de inventario</p>
                  {hasReservedZones && seatAssignments.size > 0 && (
                    <p>✓ {venueSeats.length} asientos mapeados en {seatAssignments.size} filas</p>
                  )}
                  <p>✓ Comisión: {commRate}%</p>
                </div>
              </div>

              {/* Warnings */}
              {stepWarnings.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-400 mb-1">⚠️ Warnings</p>
                  {stepWarnings.map((w, i) => <p key={i} className="text-xs text-yellow-400/80">• {w}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-sm text-red-300">{error}</div>}

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="px-5 py-2.5 rounded-lg border border-gray-700 text-gray-300 text-sm font-medium hover:bg-[#111] transition-colors">
              {step === 1 ? 'Cancelar' : '← Anterior'}
            </button>
            {step < totalSteps ? (
              <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="px-5 py-2.5 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Siguiente →
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => handleSubmit('draft')} disabled={submitting} className="px-5 py-2.5 rounded-lg border border-gray-600 text-gray-300 text-sm font-medium hover:bg-[#111] transition-colors disabled:opacity-40">
                  {submitting ? '...' : 'Crear Borrador'}
                </button>
                <button onClick={() => handleSubmit('active')} disabled={submitting} className="px-5 py-2.5 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                  {submitting && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {submitting ? 'Creando...' : 'Crear Activo'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}