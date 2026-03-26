"use client";
import { useState, useEffect } from "react";
import AdminHeader from "./AdminHeader";
import AdminNav from "./AdminNav";

interface AdminShellProps {
  children: React.ReactNode;
  user: { name: string; email: string; role: string; permissions: string[] };
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export default function AdminShell({ children, user, activeTab, onTabChange, onLogout }: AdminShellProps) {
  const [desktopMode, setDesktopMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('dulos-desktop-mode');
    if (saved === 'true') setDesktopMode(true);
  }, []);

  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', desktopMode
        ? 'width=1280, initial-scale=0.35'
        : 'width=device-width, initial-scale=1'
      );
    }
    localStorage.setItem('dulos-desktop-mode', String(desktopMode));
  }, [desktopMode]);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AdminHeader user={user} onLogout={onLogout} />
      <AdminNav activeTab={activeTab} onTabChange={onTabChange} permissions={user.permissions} />
      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {children}
      </main>
      {/* Mobile-only desktop toggle */}
      <button
        onClick={() => setDesktopMode(!desktopMode)}
        className="fixed bottom-4 right-4 z-50 sm:hidden bg-[#1a1a2e] text-white rounded-full px-3 py-2 text-[10px] font-bold shadow-lg active:scale-95 transition-transform flex items-center gap-1.5"
      >
        {desktopMode ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            Móvil
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Escritorio
          </>
        )}
      </button>
    </div>
  );
}
