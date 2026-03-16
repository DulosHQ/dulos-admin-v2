import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/_next/",
  "/favicon",
  "/api/webhooks/stripe",
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow public paths and static assets (files with extensions)
  if (PUBLIC_PATHS.some((p) => path.startsWith(p)) || path.includes(".")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Verify Supabase session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No valid session - redirect to login
  if (!user?.email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // HARDLOCK: Only allow specific emails - checked BEFORE dulos_team
  const ALLOWED_EMAILS = ["angel.lopez@vulkn-ai.com"];

  if (!ALLOWED_EMAILS.includes(user.email!.toLowerCase())) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }

  // User is authenticated - now verify they're in dulos_team
  try {
    const teamCheckResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/dulos_team?email=eq.${encodeURIComponent(user.email)}&select=email,is_active`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
      }
    );

    if (!teamCheckResponse.ok) {
      console.error("Failed to check dulos_team:", teamCheckResponse.status);
      return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
    }

    const team = await teamCheckResponse.json();

    // Not in team or not active
    if (!team || team.length === 0 || !team[0].is_active) {
      return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
    }

    // Valid team member - allow request
    response.headers.set("X-Dulos-Security", "v5");
    return response;
  } catch (error) {
    console.error("Middleware team check error:", error);
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
