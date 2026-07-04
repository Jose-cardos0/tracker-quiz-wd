"use client";

import { useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

const PRESETS = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "all", label: "Tudo" },
];

function dayBounds(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + 1);
  return { from: s.toISOString(), to: e.toISOString() };
}

export default function RangeTabs({ current }: { current: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function go(mut: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(params.toString());
    mut(sp);
    router.push(`${pathname}?${sp.toString()}`);
  }

  function preset(key: string) {
    setOpen(false);
    go((sp) => {
      sp.set("range", key);
      if (key === "today") {
        const b = dayBounds(new Date());
        sp.set("from", b.from);
        sp.set("to", b.to);
      } else if (key === "yesterday") {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const b = dayBounds(d);
        sp.set("from", b.from);
        sp.set("to", b.to);
      } else {
        sp.delete("from");
        sp.delete("to");
      }
    });
  }

  function applyCustom() {
    if (!from || !to) return;
    const s = new Date(from + "T00:00:00");
    const e = new Date(to + "T00:00:00");
    e.setDate(e.getDate() + 1);
    setOpen(false);
    go((sp) => {
      sp.set("range", "custom");
      sp.set("from", s.toISOString());
      sp.set("to", e.toISOString());
    });
  }

  const isCustom = current === "custom";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
        {PRESETS.map((r) => (
          <button
            key={r.key}
            onClick={() => preset(r.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
              current === r.key
                ? "bg-white shadow-sm text-ink"
                : "text-slate-500 hover:text-ink"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* seletor de período (dropdown) */}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            isCustom
              ? "border-brand-300 bg-brand-50 text-brand-700"
              : "border-slate-200 bg-white text-slate-600 hover:text-ink"
          }`}
        >
          <Calendar className="w-4 h-4" />
          {isCustom ? "Personalizado ✓" : "Período"}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-2 z-20 w-72 card p-4 shadow-cardhover">
              <div className="text-xs font-semibold text-slate-500 mb-2">
                Intervalo personalizado
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">De</label>
                  <input
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                    className="input py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Até</label>
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                    className="input py-2 text-sm"
                  />
                </div>
                <button
                  onClick={applyCustom}
                  disabled={!from || !to}
                  className="btn-brand w-full py-2 text-sm disabled:opacity-40"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
