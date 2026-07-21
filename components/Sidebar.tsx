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
      {/* sidebar (desktop) */}
      <aside className="hidden lg:flex fixed top-16 left-0 bottom-0 w-60 flex-col border-r border-slate-200/80 bg-white px-3 py-5 z-20">
        <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Navegação
        </div>
        <nav className="flex flex-col gap-1">
          {ITEMS.map((it) => {
            const Icon = it.icon;
            const on = active(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  on
                    ? "bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                    : "text-slate-500 hover:bg-slate-50 hover:text-ink"
                }`}
              >
                {on && (
                  <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full bg-brand-600" />
                )}
                <Icon
                  className="w-[18px] h-[18px] shrink-0"
                  strokeWidth={2.2}
                />
                {it.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* tabs (mobile/tablet) */}
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
