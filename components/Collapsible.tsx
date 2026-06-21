"use client";

import { useState } from "react";

export default function Collapsible({
  title,
  subtitle,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-4 text-left hover:bg-slate-50/60 transition"
      >
        <div className="min-w-0">
          <h2 className="font-bold text-ink">{title}</h2>
          {subtitle && <p className="text-[13px] text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!open && summary && (
            <span className="text-xs text-slate-500 hidden sm:block">{summary}</span>
          )}
          <svg
            viewBox="0 0 24 24"
            className={`w-5 h-5 text-slate-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>
      {open && <div className="px-5 sm:px-6 pb-6">{children}</div>}
    </section>
  );
}
