"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function validateTeamMember(email: string): Promise<{ valid: boolean; error?: string }> {
  // HARDLOCK: Only allow specific email
  if (email.toLowerCase() !== "angel.lopez@vulkn-ai.com") {
    return { valid: false, error: "Acceso denegado." };
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/dulos_team?email=eq.${encodeURIComponent(email)}&select=email,is_active`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      }
    );
    const team = await res.json();

    if (!team || team.length === 0) {
      return { valid: false, error: "No tienes acceso al sistema. Contacta al administrador." };
    }

    if (!team[0].is_active) {
      return { valid: false, error: "Tu cuenta ha sido desactivada." };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Error de conexión. Intenta de nuevo." };
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Check for access denied error from OAuth callback
  useEffect(() => {
    if (searchParams?.get("error") === "acceso_denegado") {
      setAccessDenied(true);
    }
  }, [searchParams]);

  // Non-blocking session check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      getSupabase().auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email?.toLowerCase() === "angel.lopez@vulkn-ai.com") {
          router.replace("/");
        }
      }).catch(() => {});
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabase();
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });

    if (authErr) {
      setError("Correo o contraseña incorrectos");
      setLoading(false);
      return;
    }

    if (data.user?.email) {
      // Validate against dulos_team
      const result = await validateTeamMember(data.user.email);
      if (result.valid) {
        localStorage.setItem("dulos_sec_v", "v4");
        router.push("/");
      } else {
        await supabase.auth.signOut();
        setError(result.error || "No tienes acceso al sistema.");
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    setAccessDenied(false);
    localStorage.removeItem("dulos_user");
    const supabase = getSupabase();

    // Set a 10-second timeout for OAuth redirect
    const timeoutId = setTimeout(() => {
      setError("Error al conectar con Google. Intenta de nuevo.");
      setLoading(false);
    }, 10000);

    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (oauthErr) {
      clearTimeout(timeoutId);
      setError("Error al conectar con Google");
      setLoading(false);
    }
    // Note: If OAuth succeeds, the page will redirect and timeout won't fire
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="bg-[#111] rounded-2xl p-8 w-full max-w-md border border-white/10">
        <div className="flex justify-center mb-6">
          <Image src="/dulos-logo.svg" alt="Dulos" width={180} height={56} priority />
        </div>
        <h1 className="text-white text-xl font-semibold text-center">Panel de Administración</h1>
        <p className="text-gray-500 text-sm text-center mt-1 mb-6">Acceso exclusivo para personal autorizado</p>

        {accessDenied && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-red-400 text-sm text-center">
            <span className="block text-lg mb-1">⛔</span>
            Acceso denegado. Este panel es de uso exclusivo. Tu cuenta de Google no está autorizada.
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <button type="button" onClick={handleGoogle} disabled={loading}
          className="w-full bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-800 font-medium py-3 rounded-lg transition flex items-center justify-center gap-3 cursor-pointer mb-6">
          <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continuar con Google
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-gray-600 text-xs">o con correo</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-[#E63946] focus:outline-none transition" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" required
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-[#E63946] focus:outline-none transition" />
          <button type="submit" disabled={loading}
            className="w-full bg-[#E63946] hover:bg-[#c62d3a] disabled:opacity-50 text-white font-bold py-3 rounded-lg transition cursor-pointer">
            {loading ? "Verificando..." : "Iniciar Sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
