"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, X, ChevronDown, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { pct, fmtDuration } from "@/lib/format";
import type { Overview, FunnelRow, TimingRow, CampaignRow } from "@/lib/data";
import CompareInsights from "@/components/CompareInsights";

const COLORS = ["#4f46e5", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6"];

type Col = {
  project: {
    id: string;
    name: string;
    slug: string;
    url: string;
    total_steps: number | null;
    step_names: Record<string, string> | null;
  };
  ov: Overview;
  funnel: FunnelRow[];
  timing: TimingRow[];
  campaigns: CampaignRow[];
};

const SECTIONS = [
  { key: "funnel", title: "Funil por etapa" },
  { key: "timing", title: "Tempo por etapa" },
  { key: "campaigns", title: "Campanhas" },
];

export default function CompareView({
  cols,
  allProjects,
}: {
  cols: Col[];
  allProjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<Set<string>>(new Set(["funnel"]));
  const [adding, setAdding] = useState(false);

  const ids = cols.map((c) => c.project.id);
  const colorOf = (i: number) => COLORS[i % COLORS.length];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState({ left: false, right: false });
  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setArrows({
      left: el.scrollLeft > 8,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
  }
  useEffect(() => {
    updateArrows();
    const on = () => updateArrows();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols.length]);
  function scroll(dir: number) {
    scrollRef.current?.scrollBy({ left: dir * 380, behavior: "smooth" });
  }

  function nav(newIds: string[]) {
    const sp = new URLSearchParams(params.toString());
    if (newIds.length) sp.set("ids", newIds.join(","));
    else sp.delete("ids");
    router.push(`${pathname}?${sp.toString()}`);
  }
  function add(id: string) {
    setAdding(false);
    if (!ids.includes(id)) nav([...ids, id]);
  }
  function remove(id: string) {
    nav(ids.filter((x) => x !== id));
  }
  function toggle(key: string) {
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  const available = allProjects.filter((p) => !ids.includes(p.id));

  if (cols.length === 0) {
    return (
      <div className="card card-pad text-center py-16">
        <h3 className="font-bold text-ink">Escolha funis para comparar</h3>
        <p className="text-sm text-slate-500 mt-1 mb-5">
          Adicione dois ou mais funis para ver lado a lado.
        </p>
        <AddPicker available={allProjects} onPick={add} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-slate-500">
          {cols.length} {cols.length === 1 ? "funil" : "funis"} em comparação
        </span>
        {available.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setAdding((a) => !a)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              <Plus className="w-4 h-4" /> Adicionar funil
            </button>
            {adding && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAdding(false)} />
                <div className="absolute left-0 mt-2 z-20 w-64 card p-1.5 shadow-cardhover max-h-72 overflow-y-auto">
                  {available.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => add(p.id)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 truncate"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <CompareInsights cols={cols} colorOf={colorOf} show="verdict" />

      <div className="relative">
        {arrows.left && (
          <button
            onClick={() => scroll(-1)}
            aria-label="Rolar para a esquerda"
            className="hidden sm:grid place-items-center absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white border border-orange-200 shadow-lg text-orange-500 hover:bg-orange-50 hover:text-orange-600 transition"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2.6} />
          </button>
        )}
        {arrows.right && (
          <button
            onClick={() => scroll(1)}
            aria-label="Rolar para a direita"
            className="hidden sm:grid place-items-center absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white border border-orange-200 shadow-lg text-orange-500 hover:bg-orange-50 hover:text-orange-600 transition"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={2.6} />
          </button>
        )}
        <div ref={scrollRef} onScroll={updateArrows} className="flex gap-4 overflow-x-auto pb-3 scroll-smooth no-scrollbar">
        {cols.map((col, ci) => (
          <div key={col.project.id} className="min-w-[340px] max-w-[440px] flex-1 shrink-0">
            {/* header */}
            <div className="card card-pad mb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorOf(ci) }} />
                    <Link href={`/projects/${col.project.id}`} className="font-bold text-ink truncate hover:text-brand-600">
                      {col.project.name}
                    </Link>
                  </div>
                  <a
                    href={col.project.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-600 hover:underline inline-flex items-center gap-0.5 max-w-full mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">{col.project.url}</span>
                    <ArrowUpRight className="w-3 h-3 shrink-0" />
                  </a>
                </div>
                <button onClick={() => remove(col.project.id)} title="Remover" className="text-slate-300 hover:text-rose-500 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Mini label="Sessões" value={col.ov.sessions.toLocaleString("pt-BR")} />
                <Mini label="Concl." value={pct(col.ov.completed, col.ov.sessions)} accent />
                <Mini label="Tempo" value={fmtDuration(col.ov.avg_duration_ms)} />
              </div>
            </div>

            {/* synced sections */}
            {SECTIONS.map((sec) => {
              const isOpen = open.has(sec.key);
              return (
                <div key={sec.key} className="card mb-3 overflow-hidden">
                  <button
                    onClick={() => toggle(sec.key)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50/60 transition"
                  >
                    <span className="font-bold text-ink text-sm">{sec.title}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      {sec.key === "funnel" && <FunnelBars col={col} />}
                      {sec.key === "timing" && <TimingBars col={col} />}
                      {sec.key === "campaigns" && <CampaignsMini col={col} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        </div>
      </div>
      {(arrows.left || arrows.right) && (
        <p className="text-center text-xs text-slate-400 mt-1 mb-2">
          Arraste para o lado para ver todas as colunas
        </p>
      )}

      {/* gráficos de comparação (abaixo das colunas) */}
      <CompareInsights cols={cols} colorOf={colorOf} show="charts" />
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={`text-lg font-black tracking-tight ${accent ? "text-brand-600" : "text-ink"}`}>{value}</div>
      <div className="stat-label mt-0.5">{label}</div>
    </div>
  );
}

function stepName(col: Col, i: number) {
  const names = (col.project.step_names || {}) as Record<string, string>;
  return names[String(i)] || `Etapa ${i}`;
}

function FunnelBars({ col }: { col: Col }) {
  const { funnel } = col;
  if (!funnel.length) return <Empty />;
  const base = funnel[0].sessions_reached || 0;
  let worst = { step: 0, lost: 0 };
  for (let i = 1; i < funnel.length; i++) {
    const lost = funnel[i - 1].sessions_reached - funnel[i].sessions_reached;
    if (lost > worst.lost) worst = { step: funnel[i].step_index, lost };
  }
  return (
    <div className="space-y-1.5">
      {funnel.map((r) => {
        const w = base ? (r.sessions_reached / base) * 100 : 0;
        const isWorst = r.step_index === worst.step && worst.lost > 0;
        return (
          <div key={r.step_index}>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="font-semibold text-slate-600 truncate">
                {r.step_index}. {stepName(col, r.step_index)}
              </span>
              <span className="text-slate-400 tabular-nums shrink-0 pl-2">{pct(r.sessions_reached, base)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isWorst ? "bg-rose-400" : "bg-brand-500"}`}
                style={{ width: `${Math.max(w, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimingBars({ col }: { col: Col }) {
  const { funnel, timing } = col;
  if (!timing.length) return <Empty />;
  const map = new Map(timing.map((t) => [t.step_index, t]));
  const max = Math.max(1, ...timing.map((t) => t.median_ms));
  return (
    <div className="space-y-1.5">
      {funnel.map((r) => {
        const t = map.get(r.step_index);
        const med = t?.median_ms || 0;
        return (
          <div key={r.step_index}>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="font-semibold text-slate-600 truncate">
                {r.step_index}. {stepName(col, r.step_index)}
              </span>
              <span className="text-slate-400 tabular-nums shrink-0 pl-2">{fmtDuration(med)}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.max((med / max) * 100, 2)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CampaignsMini({ col }: { col: Col }) {
  const { campaigns } = col;
  if (!campaigns.length) return <Empty />;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wide">
          <th className="py-1 font-semibold">Origem</th>
          <th className="py-1 font-semibold text-right">Sess.</th>
          <th className="py-1 font-semibold text-right">Concl.</th>
        </tr>
      </thead>
      <tbody>
        {campaigns.slice(0, 8).map((c, i) => (
          <tr key={i} className="border-t border-slate-100">
            <td className="py-1.5 text-slate-700 truncate max-w-[120px]">{c.source}</td>
            <td className="py-1.5 text-right tabular-nums">{c.sessions}</td>
            <td className="py-1.5 text-right tabular-nums text-slate-400">{pct(c.completed, c.sessions)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty() {
  return <p className="text-xs text-slate-400 py-2">Sem dados.</p>;
}

function AddPicker({
  available,
  onPick,
}: {
  available: { id: string; name: string }[];
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)} className="btn-brand">
        <Plus className="w-4 h-4" /> Adicionar funil
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 -translate-x-1/2 mt-2 z-20 w-64 card p-1.5 shadow-cardhover max-h-72 overflow-y-auto text-left">
            {available.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setOpen(false);
                  onPick(p.id);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 truncate"
              >
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
