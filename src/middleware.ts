import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/_next/",
  "/favicon",
  "/api/webhooks/stripe",
  "/api/health",
  "/api/meta-proxy",
  "/api/test-coupons",
  "/dulos-logo.svg",
];

// Hardcoded founders always have access + team_members from DB
const FOUNDER_EMAILS = ["angel.lopez@vulkn-ai.com", "tamaravulkn@gmail.com", "paolo@dulos.io", "juan.sotelo@dulos.io"];
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");
  response.headers.set("X-DNS-Prefetch-Control", "on");
  return response;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow public paths and static files
  if (PUBLIC_PATHS.some((p) => path.startsWith(p)) || path.includes(".")) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // Create mutable response to pass cookies through
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update cookies on both request (for downstream) and response (for browser)
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // IMPORTANT: Use getUser() not getSession() for security
  // getUser() validates the JWT against Supabase, getSession() only reads from cookie
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user?.email) {
    // No valid session - redirect to login
    const url = new URL("/login", request.url);
    return addSecurityHeaders(NextResponse.redirect(url));
  }

  const emailLower = user.email.toLowerCase();
  if (!FOUNDER_EMAILS.includes(emailLower)) {
    // Check if user is in team_members (dynamic access)
    try {
      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://udjwabtyhjcrpyuffavz.supabase.co';
      const res = await fetch(`${sbUrl}/rest/v1/team_members?email=eq.${encodeURIComponent(emailLower)}&is_active=eq.true&select=id&limit=1`, {
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
      });
      const members = await res.json();
      if (!Array.isArray(members) || members.length === 0) {
        const url = new URL("/login", request.url);
        url.searchParams.set("error", "unauthorized");
        return addSecurityHeaders(NextResponse.redirect(url));
      }
    } catch {
      const url = new URL("/login", request.url);
      url.searchParams.set("error", "unauthorized");
      return addSecurityHeaders(NextResponse.redirect(url));
    }
  }

  // User is authenticated and authorized
  response.headers.set("X-Dulos-Security", "v7");
  return addSecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
