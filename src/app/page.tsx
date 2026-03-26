"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import SummaryPage from "@/pages/SummaryPage";
import FinancePage from "@/pages/FinancePage";
import LiquidacionesPage from "@/pages/LiquidacionesPage";
import AdsPage from "@/pages/AdsPage";
import EventsPage from "@/pages/EventsPage";
import OpsPage from "@/pages/OpsPage";
import AdminPage from "@/pages/AdminPage";
import AdminShell from "@/layouts/AdminShell";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type DashboardUser = {
  email: string;
  name: string;
  role: string;
  permissions: string[];
};

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Middleware already verified auth session, but permissions must come from server
      const { data: { session } } = await getSupabase().auth.getSession();

      if (!session?.user?.email) {
        if (mounted) router.push("/login");
        return;
      }

      const meRes = await fetch('/api/auth/permissions', { cache: 'no-store' });
      if (!meRes.ok) {
        if (mounted) {
          await getSupabase().auth.signOut();
          router.push('/login?error=unauthorized');
        }
        return;
      }

      const me = await meRes.json();
      const userObj: DashboardUser = {
        email: me.email,
        name: me.name,
        role: me.role,
        permissions: Array.isArray(me.permissions) ? me.permissions : [],
      };

      if (mounted) {
        setUser(userObj);
        setLoading(false);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    await getSupabase().auth.signOut();
    localStorage.removeItem("dulos_user");
    localStorage.removeItem("dulos_sec_v");
    router.push("/login");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto space-y-4 animate-pulse">
          <div className="h-16 bg-gray-200 rounded-lg"></div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-40 bg-gray-200 rounded-lg"></div>
            <div className="h-40 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  const pages: Record<string, React.ReactNode> = {
    resumen: <SummaryPage />,
    finanzas: <FinancePage />,
    liquidaciones: <LiquidacionesPage />,
    ads: <AdsPage />,
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
