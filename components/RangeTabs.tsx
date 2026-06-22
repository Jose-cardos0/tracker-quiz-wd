"use client";

import { useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

const PRESETS = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "all", label: "Tudo" },
];

/** Local day boundaries -> [start, nextDayStart) ISO. */
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function go(mut: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(params.toString());
    mut(sp);
    router.push(`${pathname}?${sp.toString()}`);
  }

  function preset(key: string) {
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
    e.setDate(e.getDate() + 1); // make `to` inclusive
    go((sp) => {
      sp.set("range", "custom");
      sp.set("from", s.toISOString());
      sp.set("to", e.toISOString());
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
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

      <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl pl-3 pr-1.5 py-1">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
          className="text-sm text-slate-600 outline-none bg-transparent"
        />
        <span className="text-slate-300">→</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
          className="text-sm text-slate-600 outline-none bg-transparent"
        />
        <button
          onClick={applyCustom}
          disabled={!from || !to}
          className={`text-sm font-semibold px-2.5 py-1.5 rounded-lg transition ${
            from && to
              ? "bg-ink text-white hover:bg-slate-700"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          Aplicar
        </button>
      </div>

      {current === "custom" && (
        <span className="text-xs font-semibold text-brand-600 bg-brand-50 rounded-full px-2.5 py-1">
          intervalo personalizado
        </span>
      )}
    </div>
  );
}
