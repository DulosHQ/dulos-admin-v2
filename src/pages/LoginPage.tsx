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
        </form>
      </div>
    </div>
  );
}
