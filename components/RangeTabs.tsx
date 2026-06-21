"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";

const RANGES = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "all", label: "Tudo" },
];

export default function RangeTabs({ current }: { current: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();

  function go(key: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("range", key);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => go(r.key)}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
            current === r.key
              ? "bg-white shadow-sm text-ink"
              : "text-slate-500 hover:text-ink"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
