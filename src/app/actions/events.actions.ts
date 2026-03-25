'use server';

import { eventSchema, type EventFormData } from '@/lib/validations/events.schema';
import { logAction } from './audit.actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

export async function getEvents() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?order=dates.desc`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Error al cargar eventos' };
  }
}

export async function createEvent(formData: EventFormData) {
  const parsed = eventSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      fieldErrors[issue.path[0] as string] = issue.message;
    });
    return { success: false, error: 'Datos inválidos', fieldErrors };
  }

  try {
    const body = {
      name: parsed.data.name,
      status: parsed.data.status,
      image_url: parsed.data.image_url || '',
      description: parsed.data.description || '',
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    // Fire-and-forget audit
    logAction('create', 'event', data[0]?.id || '', JSON.stringify({ name: parsed.data.name }));
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al crear el evento' };
  }
}

export async function updateEvent(id: string, formData: EventFormData) {
  const parsed = eventSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      fieldErrors[issue.path[0] as string] = issue.message;
    });
    return { success: false, error: 'Datos inválidos', fieldErrors };
  }

  try {
    const body = {
      name: parsed.data.name,
      status: parsed.data.status,
      image_url: parsed.data.image_url || '',
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('update', 'event', id, JSON.stringify({ name: parsed.data.name }));
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al actualizar el evento' };
  }
}

export async function archiveEvent(id: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'archived' }),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('delete', 'event', id, 'Evento archivado');
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al archivar el evento' };
  }
}
