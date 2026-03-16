"use client";
import { useState } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://udjwabtyhjcrpyuffavz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTM5MzQsImV4cCI6MjA4OTE2OTkzNH0.5RxuCjEPKY2eLmSG8iwMVKJnczcBRNhQH1QADm68UW4"
);

interface LoginPageProps {
  onLogin: (user: any) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("Correo o contraseña incorrectos");
        setLoading(false);
        return;
      }

      if (data.user) {
        const { data: teamUser } = await supabase
          .from("dulos_team")
          .select("*")
          .eq("email", data.user.email)
          .eq("is_active", true)
          .single();

        if (teamUser) {
          onLogin({
            email: teamUser.email,
            name: teamUser.name,
            role: teamUser.role,
            permissions: [],
          });
        } else {
          onLogin({
            email: data.user.email,
            name: data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "Usuario",
            role: "ADMIN",
            permissions: ["finance.read", "finance.stats.global", "event.read", "project.read", "project.manage", "inventory.read", "ticket.scan", "marketing.codes.manage", "team.manage", "sys.config", "sys.audit", "access.stats"],
          });
        }
      }
    } catch {
      setError("Error de conexión");
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/auth/callback'
        }
      });
      if (error) setError('Error al conectar con Google');
    } catch {
      setError('Error de conexión');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="bg-[#111] rounded-2xl p-8 w-full max-w-md border border-white/10">
        <div className="flex justify-center mb-6">
          <Image src="/dulos-logo.svg" alt="Dulos" width={180} height={56} priority />
        </div>
        <h1 className="text-white text-xl font-semibold text-center">Panel de Administración</h1>
        <p className="text-gray-500 text-sm text-center mt-1 mb-8">Ingresa tus credenciales</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-[#E63946] focus:outline-none transition"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-[#E63946] focus:outline-none transition"
            />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E63946] hover:bg-[#c62d3a] disabled:opacity-50 text-white font-bold py-3 rounded-lg transition cursor-pointer"
          >
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
          <div className='flex items-center gap-4 mt-4'>
            <div className='flex-1 h-px bg-white/10'></div>
            <span className='text-gray-600 text-xs'>o</span>
            <div className='flex-1 h-px bg-white/10'></div>
          </div>
          <button type='button' onClick={handleGoogle} className='w-full mt-4 bg-white hover:bg-gray-100 text-gray-800 font-medium py-3 rounded-lg transition flex items-center justify-center gap-3 cursor-pointer'>
            <svg width='20' height='20' viewBox='0 0 24 24'><path d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z' fill='#4285F4'/><path d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' fill='#34A853'/><path d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z' fill='#FBBC05'/><path d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' fill='#EA4335'/></svg>
            Continuar con Google
          </button>
        </form>
      </div>
    </div>
  );
}
