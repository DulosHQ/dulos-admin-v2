import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
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
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // SECURITY: Block unauthorized emails immediately
    const userEmail = data?.user?.email?.toLowerCase();
    if (userEmail !== "angel.lopez@vulkn-ai.com") {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=acceso_denegado`);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
