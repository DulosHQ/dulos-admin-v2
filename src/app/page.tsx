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

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const stored = localStorage.getItem("dulos_user");
        if (stored) setUser(JSON.parse(stored));
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  if (loading) return <div className="min-h-screen bg-[#050505]" />;

  if (!user) {
    return <LoginPage onLogin={(u: any) => { localStorage.setItem("dulos_user", JSON.stringify(u)); setUser(u); }} />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("dulos_user");
    setUser(null);
  };

  const renderPage = () => {
    switch (activeTab) {
      case "resumen": return <SummaryPage />;
      case "finanzas": return <FinancePage />;
      case "eventos": return <EventsPage />;
      case "operaciones": return <OpsPage />;
      case "admin": return <AdminPage />;
      default: return <SummaryPage />;
    }
  };

  return (
    <AdminShell user={user} activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout}>
      {renderPage()}
    </AdminShell>
  );
}
