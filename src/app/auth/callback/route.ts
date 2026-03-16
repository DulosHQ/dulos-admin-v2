import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

  // Track cookies that need to be set on the response
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
          // Store cookies to set on the redirect response later
          cookiesToSet.forEach(({ name, value, options }) => {
            cookiesToSetOnResponse.push({ name, value, options });
            // Also try to set via cookieStore for good measure
            try {
              cookieStore.set(name, value, options);
            } catch {
              // This may fail in some contexts, but we have the backup above
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

  const email = data.session?.user?.email?.toLowerCase();
  const allowedEmails = ["angel.lopez@vulkn-ai.com", "tamaravulkn@gmail.com"];
  if (!email || !allowedEmails.includes(email)) {
    // Sign out and clear any cookies that were set
    await supabase.auth.signOut();
    const response = NextResponse.redirect(`${origin}/login?error=acceso_denegado`);
    // Clear auth cookies on denial
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
