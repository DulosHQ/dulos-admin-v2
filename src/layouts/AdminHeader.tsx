"use client";
import { useState } from "react";
import Image from "next/image";

interface AdminHeaderProps {
  user: { name: string; email: string; role: string };
  onLogout: () => void;
}

export default function AdminHeader({ user, onLogout }: AdminHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="bg-[#0a0a0a] border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 h-14 sm:h-20 flex items-center justify-center relative">
        <Image src="/dulos-logo.svg" alt="Dulos" width={160} height={50} className="h-7 sm:h-10 w-auto" priority />

        <div className="absolute right-3 sm:right-6 flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-800 rounded border border-gray-700" title="Búsqueda global (próximamente)">
            &#x2318;K
          </span>
          <button onClick={() => alert("Notificaciones (próximamente)")} className="relative p-2 text-gray-500 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </button>

          <div className="relative">
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
              <div className="w-8 h-8 rounded-full bg-[#EF4444] flex items-center justify-center text-white text-sm font-bold">
                {user.name.charAt(0)}
              </div>
              <span className="text-sm text-gray-300 hidden md:block">{user.name}</span>
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-[#1a1a1a] rounded-xl shadow-lg border border-gray-800 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-800">
                    <p className="text-sm font-medium text-white">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-[#EF4444]/10 text-[#EF4444] rounded">{user.role}</span>
                  </div>
                  <button onClick={onLogout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition">
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
