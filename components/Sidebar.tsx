"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LayoutGrid } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/", label: "Funis", icon: LayoutGrid },
];

export default function Sidebar() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/dashboard"
      ? pathname.startsWith("/dashboard")
      : !pathname.startsWith("/dashboard");

  return (
    <>
      {/* rail vertical (desktop) */}
      <aside className="hidden lg:flex fixed top-16 left-0 bottom-0 w-16 flex-col items-center gap-1.5 border-r border-slate-200/80 bg-white/70 backdrop-blur py-4 z-20">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const on = active(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.label}
              className={`w-12 py-2 rounded-xl flex flex-col items-center gap-1 text-[9.5px] font-bold transition ${
                on
                  ? "bg-brand-50 text-brand-600"
                  : "text-slate-400 hover:text-ink hover:bg-slate-50"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={2.2} />
              {it.label}
            </Link>
          );
        })}
      </aside>

      {/* tabs horizontais (mobile/tablet) */}
      <div className="lg:hidden flex gap-2 px-5 pt-4 -mb-2">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const on = active(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                on
                  ? "bg-brand-50 text-brand-600"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-ink"
              }`}
            >
              <Icon className="w-4 h-4" /> {it.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}
