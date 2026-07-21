"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Filter } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/", label: "Funis", icon: Filter },
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
      <aside className="hidden lg:flex fixed top-16 left-0 bottom-0 w-16 flex-col items-center gap-2 border-r border-slate-200/80 bg-white py-5 z-20">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const on = active(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.label}
              className="group relative flex flex-col items-center gap-1.5 w-full"
            >
              {/* barrinha de ativo na borda esquerda */}
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-brand-600 transition-all ${
                  on ? "h-7 opacity-100" : "h-0 opacity-0"
                }`}
              />
              <span
                className={`grid place-items-center w-11 h-11 rounded-2xl transition ${
                  on
                    ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30"
                    : "text-slate-400 group-hover:bg-slate-100 group-hover:text-ink"
                }`}
              >
                <Icon className="w-[22px] h-[22px]" strokeWidth={2} />
              </span>
              <span
                className={`text-[10px] font-semibold ${
                  on ? "text-brand-600" : "text-slate-400 group-hover:text-ink"
                }`}
              >
                {it.label}
              </span>
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
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                on
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-ink"
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={2.2} /> {it.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}
