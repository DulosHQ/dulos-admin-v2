'use server';

import { logAction } from './audit.actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU5MzkzNCwiZXhwIjoyMDg5MTY5OTM0fQ.-1ABMJP5sYUyW1MDg2W7T8ZE3ipe5x_Lvmec9UdZkO8';

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

export async function getZonesByEvent(eventId: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ticket_zones?event_id=eq.${eventId}`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Error al cargar zonas' };
  }
}

export async function createZone(formData: {
  event_id: string;
  zone_name: string;
  price: number;
  original_price: number;
  available: number;
}) {
  try {
    const body = {
      event_id: formData.event_id,
      zone_name: formData.zone_name,
      price: formData.price,
      original_price: formData.original_price,
      available: formData.available,
      sold: 0,
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ticket_zones`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('create', 'zone', formData.event_id, JSON.stringify({ zone_name: formData.zone_name }));
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al crear la zona' };
  }
}

export async function updateZone(id: string, formData: {
  zone_name?: string;
  price?: number;
  available?: number;
}) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ticket_zones?event_id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(formData),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('update', 'zone', id, JSON.stringify(formData));
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al actualizar la zona' };
  }
}
