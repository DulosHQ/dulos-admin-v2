import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Founders always have access regardless of team_members
const FOUNDER_EMAILS = ["angel.lopez@vulkn-ai.com", "tamaravulkn@gmail.com", "paolo@dulos.io", "juan.sotelo@dulos.io"];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function isAuthorized(email: string): Promise<boolean> {
  if (FOUNDER_EMAILS.includes(email.toLowerCase())) return true;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/team_members?email=eq.${encodeURIComponent(email.toLowerCase())}&is_active=eq.true&select=id&limit=1`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const members = await res.json();
    return Array.isArray(members) && members.length > 0;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const origin = requestUrl.origin;

  if (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(`${origin}/login?error=${error}`);
  }

  if (!code) {
    console.error("No code in callback URL");
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const cookieStore = await cookies();
  const cookiesToSetOnResponse: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookiesToSetOnResponse.push({ name, value, options });
            try {
              cookieStore.set(name, value, options);
            } catch {
              // May fail in some contexts
            }
          });
        },
      },
    }
  );

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Exchange error:", exchangeError.message);
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const email = data.session?.user?.email;
  if (!email || !(await isAuthorized(email))) {
    await supabase.auth.signOut();
    const response = NextResponse.redirect(`${origin}/login?error=acceso_denegado`);
    cookiesToSetOnResponse.forEach(({ name }) => {
      response.cookies.delete(name);
    });
    return response;
  }

  // Create redirect response and attach all session cookies
  const response = NextResponse.redirect(`${origin}/`);
  cookiesToSetOnResponse.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Record<string, unknown>);
  });

  return response;
}
