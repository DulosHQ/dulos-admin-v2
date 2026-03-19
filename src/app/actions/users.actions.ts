'use server';

import { userInviteSchema, type UserInviteFormData } from '@/lib/validations/users.schema';
import { logAction } from './audit.actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://udjwabtyhjcrpyuffavz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU5MzkzNCwiZXhwIjoyMDg5MTY5OTM0fQ.-1ABMJP5sYUyW1MDg2W7T8ZE3ipe5x_Lvmec9UdZkO8';

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

export async function getUsers() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_members?order=role`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Error al cargar usuarios' };
  }
}

export async function inviteUser(formData: UserInviteFormData) {
  const parsed = userInviteSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      fieldErrors[issue.path[0] as string] = issue.message;
    });
    return { success: false, error: 'Datos inválidos', fieldErrors };
  }

  try {
    // Check if email already exists in team_members
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/team_members?email=eq.${encodeURIComponent(parsed.data.email)}&select=id`,
      { headers, cache: 'no-store' }
    );
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      return { success: false, error: 'Este correo ya está registrado en el equipo' };
    }

    const name = parsed.data.name || parsed.data.email.split('@')[0];

    // Step 1: Create in team_members
    const body = {
      name,
      email: parsed.data.email,
      role: parsed.data.role,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_members`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error creating team member: ${res.status} ${errText}`);
    }
    const data = await res.json();

    // Step 2: Send beautiful invite email via internal API route
    let emailSent = false;
    let emailMethod = 'none';

    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://dulos-admin-v2.vercel.app';
      const emailRes = await fetch(`${baseUrl}/api/invite/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parsed.data.email, name, role: parsed.data.role }),
      });
      if (emailRes.ok) {
        const result = await emailRes.json();
        emailSent = result.emailSent || false;
        emailMethod = result.emailMethod || 'api';
      }
    } catch (e) {
      console.warn('Email API error:', e);
    }

    logAction('invite', 'user', data[0]?.id || '', JSON.stringify({ email: parsed.data.email, role: parsed.data.role, emailSent, emailMethod }));

    return {
      success: true,
      data: data[0],
      emailSent,
      message: emailSent
        ? 'Invitación enviada por correo'
        : 'Usuario creado — puede acceder con Google',
    };
  } catch (error) {
    console.error('inviteUser error:', error);
    return { success: false, error: 'Error al invitar usuario' };
  }
}

export async function updateUser(userId: string, patch: { name?: string; role?: string; is_active?: boolean }) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_members?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('update', 'user', userId, JSON.stringify(patch));
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al actualizar usuario' };
  }
}

export async function deleteUser(userId: string) {
  try {
    // Get user info for audit
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/team_members?id=eq.${userId}&select=email,name`,
      { headers, cache: 'no-store' }
    );
    const userData = await getRes.json();
    const email = userData?.[0]?.email;

    // Delete from team_members (revokes access immediately via middleware check)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_members?id=eq.${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);

    logAction('delete', 'user', userId, JSON.stringify({ email }));
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al eliminar usuario' };
  }
}

export async function updateUserRole(userId: string, role: string) {
  return updateUser(userId, { role });
}
