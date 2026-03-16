"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        const email = session.user.email.toLowerCase();
        if (email !== "angel.lopez@vulkn-ai.com") {
          await supabase.auth.signOut();
          router.replace("/login?error=acceso_denegado");
          return;
        }
        router.replace("/");
      } else {
        // Session not ready yet, wait for auth state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === "SIGNED_IN" && session?.user?.email) {
            const email = session.user.email.toLowerCase();
            if (email !== "angel.lopez@vulkn-ai.com") {
              await supabase.auth.signOut();
              router.replace("/login?error=acceso_denegado");
            } else {
              router.replace("/");
            }
            subscription.unsubscribe();
          } else if (event === "SIGNED_OUT") {
            router.replace("/login");
            subscription.unsubscribe();
          }
        });

        // Timeout fallback
        setTimeout(() => {
          subscription.unsubscribe();
          router.replace("/login?error=auth_failed");
        }, 10000);
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="animate-pulse text-gray-500 text-sm">Iniciando sesión...</div>
    </div>
  );
}
