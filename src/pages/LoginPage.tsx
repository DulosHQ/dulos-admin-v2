"use client";
import { useState } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://udjwabtyhjcrpyuffavz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTM5MzQsImV4cCI6MjA4OTE2OTkzNH0.5RxuCjEPKY2eLmSG8iwMVKJnczcBRNhQH1QADm68UW4"
);

const DEMO_USERS = [
  { email: "admin@dulos.io", password: "admin123", name: "Administrador", role: "ADMIN",
    permissions: ["finance.read","finance.stats.global","event.read","event.write","event.create","project.read","project.manage","project.create","inventory.read","inventory.write","ticket.scan","ticket.checkin","marketing.codes.manage","marketing.codes.read","team.manage","team.read","sys.config","sys.audit","sys.org.manage","access.stats","order.view.list","order.view.pii","finance.export","finance.refund","data.export.pii"] },
  { email: "operador@dulos.io", password: "oper123", name: "Operador", role: "OPERADOR",
    permissions: ["finance.read","event.read","event.write","inventory.read","ticket.scan","marketing.codes.manage","project.read","project.manage","access.stats"] },
  { email: "productor@dulos.io", password: "prod123", name: "Productor", role: "PRODUCTOR",
    permissions: ["finance.read","event.read","project.read","inventory.read"] },
  { email: "taquillero@dulos.io", password: "taq123", name: "Taquillero", role: "TAQUILLERO",
    permissions: ["ticket.scan","ticket.checkin","inventory.read"] },
];

interface LoginPageProps {
  onLogin: (user: any) => void;
  authError?: string | null;
}

export default function LoginPage({ onLogin, authError }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = DEMO_USERS.find(u => u.email === email && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError("Credenciales incorrectas");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="bg-[#111] rounded-2xl p-8 w-full max-w-md border border-white/10">
        <div className="flex justify-center mb-6">
          <Image src="/dulos-logo.svg" alt="Dulos" width={180} height={56} priority />
        </div>
        <h1 className="text-white text-xl font-semibold text-center">Panel de Administración</h1>
        <p className="text-gray-500 text-sm text-center mt-1 mb-8">Ingresa tus credenciales</p>

        {authError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6">
            <p className="text-red-400 text-sm text-center">{authError}</p>
          </div>
        )}

        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: window.location.origin + "/auth/callback" },
            });
          }}
          className="bg-white border border-gray-300 text-gray-700 font-medium py-3 rounded-lg w-full flex items-center justify-center gap-3 hover:bg-gray-50 transition mb-6"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Iniciar sesión con Google
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-gray-500 text-sm">o acceso demo</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@dulos.io"
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-[#E63946] focus:outline-none transition" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña"
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-[#E63946] focus:outline-none transition" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-[#E63946] hover:bg-[#c62d3a] text-white font-bold py-3 rounded-lg transition">
            Ingresar
          </button>
        </form>

        <div className="mt-6 text-gray-600 text-xs text-center space-y-1">
          <p className="font-medium text-gray-500">Cuentas demo:</p>
          <p>admin@dulos.io / admin123</p>
          <p>operador@dulos.io / oper123</p>
          <p>productor@dulos.io / prod123</p>
          <p>taquillero@dulos.io / taq123</p>
        </div>
      </div>
    </div>
  );
}
