"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import LoginPage from "@/pages/LoginPage";
import SummaryPage from "@/pages/SummaryPage";
import FinancePage from "@/pages/FinancePage";
import EventsPage from "@/pages/EventsPage";
import OpsPage from "@/pages/OpsPage";
import AdminPage from "@/pages/AdminPage";
import AdminShell from "@/layouts/AdminShell";

const supabase = createClient(
  "https://udjwabtyhjcrpyuffavz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTM5MzQsImV4cCI6MjA4OTE2OTkzNH0.5RxuCjEPKY2eLmSG8iwMVKJnczcBRNhQH1QADm68UW4"
);

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ["finance.read","finance.stats.global","event.read","event.write","project.read","project.manage","inventory.read","ticket.scan","marketing.codes.manage","team.manage","sys.config","sys.audit","access.stats"],
  OPERADOR: ["finance.read","event.read","event.write","inventory.read","ticket.scan","marketing.codes.manage","project.read","project.manage","access.stats"],
  PRODUCTOR: ["finance.read","event.read","project.read","inventory.read"],
  TAQUILLERO: ["ticket.scan","ticket.checkin","inventory.read"],
  SOPORTE: ["event.read","ticket.read","order.view.list"],
};

async function validateTeamMember(email: string): Promise<{ valid: boolean; user: any; error?: string }> {
  try {
    const res = await fetch(
      `https://udjwabtyhjcrpyuffavz.supabase.co/rest/v1/dulos_team?email=eq.${encodeURIComponent(email)}&select=*`,
      {
        headers: {
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTM5MzQsImV4cCI6MjA4OTE2OTkzNH0.5RxuCjEPKY2eLmSG8iwMVKJnczcBRNhQH1QADm68UW4",
          Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTM5MzQsImV4cCI6MjA4OTE2OTkzNH0.5RxuCjEPKY2eLmSG8iwMVKJnczcBRNhQH1QADm68UW4",
        },
      }
    );
    const team = await res.json();

    if (!team || team.length === 0) {
      return { valid: false, user: null, error: "No tienes acceso al sistema. Contacta al administrador." };
    }

    const member = team[0];

    if (!member.is_active) {
      return { valid: false, user: null, error: "Tu cuenta ha sido desactivada." };
    }

    return {
      valid: true,
      user: {
        email: member.email,
        name: member.name,
        role: member.role,
        permissions: ROLE_PERMISSIONS[member.role] || [],
      },
    };
  } catch {
    return { valid: false, user: null, error: "Error de conexión. Intenta de nuevo." };
  }
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // 1. Check localStorage for existing session
      const stored = localStorage.getItem("dulos_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Re-validate against dulos_team every time
        const result = await validateTeamMember(parsed.email);
        if (result.valid) {
          if (mounted) { setUser(result.user); setLoading(false); }
        } else {
          // User was removed or deactivated — clear session
          localStorage.removeItem("dulos_user");
          await supabase.auth.signOut();
          if (mounted) { setAuthError(result.error || "Sesión expirada"); setLoading(false); }
        }
        return;
      }

      // 2. Check Supabase session (Google OAuth return)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const result = await validateTeamMember(session.user.email);
        if (result.valid) {
          localStorage.setItem("dulos_user", JSON.stringify(result.user));
          if (mounted) { setUser(result.user); setLoading(false); }
        } else {
          // NOT authorized — sign out immediately
          await supabase.auth.signOut();
          if (mounted) { setAuthError(result.error || "Acceso denegado"); setLoading(false); }
        }
        return;
      }

      if (mounted) setLoading(false);
    };

    init();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Verificando acceso...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={async (u: any) => {
          // ALWAYS validate against dulos_team — NO exceptions
          const result = await validateTeamMember(u.email);
          if (result.valid) {
            localStorage.setItem("dulos_user", JSON.stringify(result.user));
            setUser(result.user);
            setAuthError("");
          } else {
            // REJECT — not in dulos_team
            await supabase.auth.signOut();
            localStorage.removeItem("dulos_user");
            setAuthError(result.error || "No tienes acceso al sistema.");
          }
        }}
        authError={authError}
      />
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("dulos_user");
    setUser(null);
    setAuthError("");
  };

  const pages: Record<string, React.ReactNode> = {
    resumen: <SummaryPage />,
    finanzas: <FinancePage />,
    eventos: <EventsPage />,
    operaciones: <OpsPage />,
    admin: <AdminPage />,
  };

  return (
    <AdminShell user={user} activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout}>
      {pages[activeTab] || <SummaryPage />}
    </AdminShell>
  );
}
