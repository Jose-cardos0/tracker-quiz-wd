"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  Activity,
  Users,
  Target,
  ShoppingCart,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { pct, fmtDuration } from "@/lib/format";
import FunnelPicker from "@/components/FunnelPicker";

type NameCount = { name: string; sessions: number; completed: number };
type CampaignAgg = {
  source: string;
  campaign: string;
  sessions: number;
  completed: number;
};
type Funnel = {
  id: string;
  name: string;
  sessions: number;
  visitors: number;
  completed: number;
  ic: number;
  avgDurationMs: number | null;
  daily: { date: string; sessions: number; completed: number }[];
  icDaily: { date: string; ic: number }[];
  bySource: NameCount[];
  byCountry: NameCount[];
  campaigns: CampaignAgg[];
};

const PALETTE = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#6366f1",
];
const KEY = "dash:sel:v1";

export default function DashboardClient({ funnels }: { funnels: Funnel[] }) {
  const allIds = funnels.map((f) => f.id);
  const allKey = allIds.join(",");
  const [selected, setSelected] = useState<string[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expandComp, setExpandComp] = useState(false);
  const [campPage, setCampPage] = useState(1);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        const valid = allIds.filter((id) => arr.includes(id));
        setSelected(valid.length ? valid : allIds);
      } else setSelected(allIds);
    } catch {
      setSelected(allIds);
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKey]);

  useEffect(() => {
    if (!loaded || !selected) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(selected));
    } catch {}
  }, [loaded, selected]);

  const sel = selected ?? allIds;
  const selSet = useMemo(() => new Set(sel), [sel]);
  const chosen = useMemo(
    () => funnels.filter((f) => selSet.has(f.id)),
    [funnels, selSet]
  );

  // ---- agregações --------------------------------------------------------
  const agg = useMemo(() => {
    const sessions = chosen.reduce((s, f) => s + f.sessions, 0);
    const visitors = chosen.reduce((s, f) => s + f.visitors, 0);
    const completed = chosen.reduce((s, f) => s + f.completed, 0);
    const ic = chosen.reduce((s, f) => s + f.ic, 0);
    const durWeighted = chosen.reduce(
      (s, f) => s + (f.avgDurationMs || 0) * f.sessions,
      0
    );
    const avgDur = sessions ? Math.round(durWeighted / sessions) : 0;
    return { sessions, visitors, completed, ic, avgDur };
  }, [chosen]);

  const daily = useMemo(() => {
    const m = new Map<
      string,
      { sessions: number; completed: number; ic: number }
    >();
    const get = (date: string) => {
      let e = m.get(date);
      if (!e) {
        e = { sessions: 0, completed: 0, ic: 0 };
        m.set(date, e);
      }
      return e;
    };
    for (const f of chosen) {
      for (const d of f.daily) {
        const e = get(d.date);
        e.sessions += d.sessions;
        e.completed += d.completed;
      }
      for (const d of f.icDaily) get(d.date).ic += d.ic;
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
        ...v,
      }));
  }, [chosen]);

  const compare = useMemo(
    () =>
      chosen
        .map((f) => ({
          id: f.id,
          name: f.name,
          sessions: f.sessions,
          comp: f.sessions ? Math.round((f.completed / f.sessions) * 100) : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions),
    [chosen]
  );

  const share = useMemo(
    () =>
      compare
        .filter((c) => c.sessions > 0)
        .map((c) => ({ name: c.name, value: c.sessions })),
    [compare]
  );

  // destaques: melhor conversão, melhor IC, maior volume (amostra mínima p/ ratio)
  const destaques = useMemo(() => {
    const withData = chosen.filter((f) => f.sessions > 0);
    const enough = withData.filter((f) => f.sessions >= 10);
    const pool = enough.length ? enough : withData;
    const bestBy = (fn: (f: Funnel) => number) =>
      pool.length ? pool.reduce((a, b) => (fn(b) > fn(a) ? b : a)) : null;
    return {
      conv: bestBy((f) => f.completed / f.sessions),
      ic: bestBy((f) => f.ic / f.sessions),
      vol: withData.length
        ? withData.reduce((a, b) => (b.sessions > a.sessions ? b : a))
        : null,
    };
  }, [chosen]);

  // origem e país agregados across selected
  const mergeCount = (rows: NameCount[][]) => {
    const m = new Map<string, number>();
    for (const list of rows)
      for (const r of list) m.set(r.name, (m.get(r.name) || 0) + r.sessions);
    return [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };
  const bySource = useMemo(
    () => mergeCount(chosen.map((f) => f.bySource)),
    [chosen]
  );
  const byCountry = useMemo(
    () => mergeCount(chosen.map((f) => f.byCountry)),
    [chosen]
  );

  // ranking de campanhas cruzado entre os funis selecionados
  const campaigns = useMemo(() => {
    const m = new Map<
      string,
      { source: string; campaign: string; sessions: number; completed: number }
    >();
    for (const f of chosen)
      for (const c of f.campaigns) {
        const k = `${c.source}|||${c.campaign}`;
        const e =
          m.get(k) || {
            source: c.source,
            campaign: c.campaign,
            sessions: 0,
            completed: 0,
          };
        e.sessions += c.sessions;
        e.completed += c.completed;
        m.set(k, e);
      }
    return [...m.values()].sort((a, b) => b.sessions - a.sessions);
  }, [chosen]);

  // gargalo geral: funil macro Sessões -> Concluíram -> Checkout
  const gargalo = useMemo(() => {
    const s = agg.sessions;
    const c = agg.completed;
    const i = agg.ic;
    const dropComplete = s ? Math.round(((s - c) / s) * 100) : 0;
    const dropCheckout = c ? Math.round(((c - i) / c) * 100) : 0;
    const stages = [
      { key: "complete", label: "Sessões → Concluíram", drop: dropComplete, lost: s - c },
      { key: "checkout", label: "Concluíram → Checkout", drop: dropCheckout, lost: c - i },
    ];
    const worst = stages.reduce((a, b) => (b.drop > a.drop ? b : a), stages[0]);
    return { s, c, i, dropComplete, dropCheckout, worst };
  }, [agg]);

  function exportCsv() {
    const cell = (v: string | number) => {
      const s = String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const conv = (a: number, b: number) =>
      b ? ((a / b) * 100).toFixed(1) : "0";
    const header = [
      "Funil",
      "Sessoes",
      "Visitantes",
      "Concluiram",
      "Conversao %",
      "IC",
      "IC %",
      "Tempo medio (s)",
    ];
    const body = chosen.map((f) => [
      f.name,
      f.sessions,
      f.visitors,
      f.completed,
      conv(f.completed, f.sessions),
      f.ic,
      conv(f.ic, f.sessions),
      Math.round((f.avgDurationMs || 0) / 1000),
    ]);
    const total = [
      "TOTAL",
      agg.sessions,
      agg.visitors,
      agg.completed,
      conv(agg.completed, agg.sessions),
      agg.ic,
      conv(agg.ic, agg.sessions),
      Math.round(agg.avgDur / 1000),
    ];
    const csv =
      "﻿" +
      [header, ...body, total].map((r) => r.map(cell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dashboard-funis.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (funnels.length === 0) {
    return (
      <div className="card card-pad text-center py-16 text-slate-400">
        Nenhum funil ainda.
      </div>
    );
  }

  return (
    <div>
      {/* seletor de funis (popup com lupa) */}
      <div className="mb-6">
        <FunnelPicker
          funnels={funnels.map((f) => ({ id: f.id, name: f.name }))}
          value={sel}
          onChange={(ids) => setSelected(ids)}
        />
      </div>

      {chosen.length === 0 ? (
        <div className="card card-pad text-center py-16 text-slate-400">
          Selecione ao menos um funil pra ver as métricas.
        </div>
      ) : (
        <>
          {/* toolbar */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="text-sm text-slate-400">
              {chosen.length} {chosen.length === 1 ? "funil" : "funis"} no
              cruzamento
            </span>
            <button onClick={exportCsv} className="btn-ghost text-sm">
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Kpi icon={Activity} label="Sessões" value={agg.sessions.toLocaleString("pt-BR")} grad="from-indigo-500 to-violet-500" />
            <Kpi icon={Users} label="Visitantes" value={agg.visitors.toLocaleString("pt-BR")} grad="from-sky-500 to-cyan-500" />
            <Kpi icon={Target} label="Conclusão" value={pct(agg.completed, agg.sessions)} sub={`${agg.completed.toLocaleString("pt-BR")} concl.`} grad="from-emerald-500 to-teal-500" />
            <Kpi icon={ShoppingCart} label="Iniciou checkout" value={pct(agg.ic, agg.sessions)} sub={`${agg.ic.toLocaleString("pt-BR")} IC`} grad="from-orange-500 to-amber-500" />
            <Kpi icon={Clock} label="Tempo médio" value={fmtDuration(agg.avgDur)} grad="from-fuchsia-500 to-pink-500" />
          </div>

          {/* destaques — prioridade: IC > conversão > volume */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Highlight
              tone="orange"
              rank={1}
              label="Melhor checkout (IC)"
              funnel={destaques.ic}
              metric={(f) => pct(f.ic, f.sessions)}
              sub={(f) => `${f.ic.toLocaleString("pt-BR")} IC · ${pct(f.completed, f.sessions)} concl.`}
            />
            <Highlight
              tone="emerald"
              rank={2}
              label="Melhor conversão"
              funnel={destaques.conv}
              metric={(f) => pct(f.completed, f.sessions)}
              sub={(f) => `${f.completed.toLocaleString("pt-BR")} concluíram`}
            />
            <Highlight
              tone="brand"
              label="Maior volume"
              funnel={destaques.vol}
              metric={(f) => `${f.sessions.toLocaleString("pt-BR")}`}
              sub={() => "sessões no período"}
            />
          </div>

          {/* gargalo geral */}
          <section className="card card-pad mb-6">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-rose-50 text-rose-600">
                <TrendingDown className="w-4 h-4" strokeWidth={2.2} />
              </span>
              <h3 className="font-bold text-ink">Gargalo geral</h3>
            </div>
            <p className="text-[13px] text-slate-400 mb-4">
              Onde o funil geral mais perde gente — Sessões → Concluíram →
              Checkout.
            </p>
            <div className="space-y-2.5">
              {[
                { label: "Sessões", n: gargalo.s, tone: "brand", drop: 0 },
                { label: "Concluíram", n: gargalo.c, tone: "emerald", drop: gargalo.dropComplete },
                { label: "Iniciou checkout", n: gargalo.i, tone: "orange", drop: gargalo.dropCheckout },
              ].map((st, i) => {
                const pctBase = gargalo.s ? Math.round((st.n / gargalo.s) * 100) : 0;
                const grad =
                  st.tone === "brand"
                    ? "from-brand-400 to-brand-600"
                    : st.tone === "emerald"
                    ? "from-emerald-400 to-emerald-500"
                    : "from-orange-400 to-orange-500";
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-[13px] font-semibold text-slate-700">
                        {st.label}
                      </span>
                      <div className="flex items-center gap-2">
                        {i > 0 && st.drop > 0 && (
                          <span className="text-[11px] font-bold rounded-full px-1.5 py-0.5 bg-rose-100 text-rose-700">
                            −{st.drop}%
                          </span>
                        )}
                        <span className="text-[13px] tabular-nums text-slate-400">
                          <b className="text-ink">
                            {st.n.toLocaleString("pt-BR")}
                          </b>{" "}
                          · {pctBase}%
                        </span>
                      </div>
                    </div>
                    <div className="h-7 rounded-lg bg-slate-50 ring-1 ring-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-lg bg-gradient-to-r ${grad} transition-all duration-500`}
                        style={{ width: `${Math.max(pctBase, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {gargalo.s > 0 && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50 text-rose-700 px-4 py-3 text-[13px]">
                <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Maior perda em <b>{gargalo.worst.label}</b> — cai{" "}
                  <b>{gargalo.worst.drop}%</b> (
                  {gargalo.worst.lost.toLocaleString("pt-BR")} sessões).
                </span>
              </div>
            )}
          </section>

          {/* sessões por dia */}
          <section className="card card-pad mb-6">
            <h3 className="font-bold text-ink mb-1">Sessões por dia</h3>
            <p className="text-[13px] text-slate-400 mb-3">Somatório dos funis selecionados.</p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dSess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} minTickGap={20} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} labelStyle={{ fontWeight: 700, color: "#0f172a" }} />
                  <Area type="monotone" dataKey="sessions" name="Sessões" stroke="#4f46e5" strokeWidth={2.5} fill="url(#dSess)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="completed" name="Concluíram" stroke="#10b981" strokeWidth={2} fill="transparent" isAnimationActive={false} />
                  <Area type="monotone" dataKey="ic" name="Iniciou checkout" stroke="#f97316" strokeWidth={2} fill="transparent" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-5 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-1 rounded bg-brand-600" /> Sessões</span>
              <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-1 rounded bg-emerald-500" /> Concluíram</span>
              <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-1 rounded bg-orange-500" /> Iniciou checkout</span>
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* comparativo por funil — top 10 + expandir */}
            <section className="card card-pad">
              <h3 className="font-bold text-ink mb-1">Comparativo por funil</h3>
              <p className="text-[13px] text-slate-400 mb-3">Sessões · % conclusão por funil.</p>
              {(() => {
                const shown = expandComp ? compare : compare.slice(0, 10);
                return (
                  <>
                    <div style={{ height: Math.max(160, shown.length * 34 + 20) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={shown} margin={{ top: 4, right: 44, left: 4, bottom: 4 }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)} />
                          <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(val: any, _n, p: any) => [`${val} sessões · ${p.payload.comp}% conclusão`, p.payload.name]} />
                          <Bar dataKey="sessions" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                            {shown.map((c) => (
                              <Cell key={c.id} fill={PALETTE[funnels.findIndex((f) => f.id === c.id) % PALETTE.length]} />
                            ))}
                            <LabelList dataKey="sessions" position="right" offset={6} style={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {compare.length > 10 && (
                      <button
                        onClick={() => setExpandComp((v) => !v)}
                        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition"
                      >
                        {expandComp ? "Ver menos" : `Ver todos (${compare.length})`}
                        <ChevronDown className={`w-4 h-4 transition-transform ${expandComp ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </>
                );
              })()}
            </section>

            {/* participação */}
            <MiniDonut
              title="Participação nas sessões"
              subtitle="Fatia de cada funil no total."
              data={share}
            />
          </div>

          {/* origem + país agregados */}
          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            <MiniDonut
              title="Origem das sessões"
              subtitle="De onde vêm — somando os funis."
              data={bySource}
            />
            <MiniDonut
              title="Por país"
              subtitle="Distribuição geográfica agregada."
              data={byCountry}
            />
          </div>

          {/* ranking de campanhas cruzado */}
          <section className="card card-pad mt-6">
            <h3 className="font-bold text-ink mb-1">Ranking de campanhas</h3>
            <p className="text-[13px] text-slate-400 mb-3">
              Campanhas somadas entre os funis selecionados — onde o dinheiro
              converte mais.
            </p>
            {campaigns.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">
                Sem campanhas com etiqueta no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-100">
                      <th className="py-2 px-2 font-semibold">#</th>
                      <th className="py-2 px-2 font-semibold">Origem</th>
                      <th className="py-2 px-2 font-semibold">Campanha</th>
                      <th className="py-2 px-2 font-semibold text-right">Sessões</th>
                      <th className="py-2 px-2 font-semibold text-right">Concluíram</th>
                      <th className="py-2 px-2 font-semibold text-right">Conversão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const PER = 10;
                      const pages = Math.max(1, Math.ceil(campaigns.length / PER));
                      const cur = Math.min(campPage, pages);
                      return campaigns
                        .slice((cur - 1) * PER, cur * PER)
                        .map((c, idx) => {
                          const rank = (cur - 1) * PER + idx + 1;
                          return (
                            <tr key={rank} className="border-t border-slate-100">
                              <td className="py-2.5 px-2 text-slate-400 tabular-nums">{rank}</td>
                              <td className="py-2.5 px-2 font-semibold text-ink">{c.source}</td>
                              <td className="py-2.5 px-2 text-slate-600 max-w-[280px] truncate" title={c.campaign}>
                                {c.campaign}
                              </td>
                              <td className="py-2.5 px-2 text-right tabular-nums text-ink font-semibold">
                                {c.sessions.toLocaleString("pt-BR")}
                              </td>
                              <td className="py-2.5 px-2 text-right tabular-nums text-slate-600">
                                {c.completed.toLocaleString("pt-BR")}
                              </td>
                              <td className="py-2.5 px-2 text-right tabular-nums font-semibold text-brand-600">
                                {pct(c.completed, c.sessions)}
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
                {campaigns.length > 10 && (
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      disabled={campPage <= 1}
                      onClick={() => setCampPage((p) => Math.max(1, p - 1))}
                      className="grid place-items-center w-7 h-7 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:text-ink transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {Math.min(campPage, Math.ceil(campaigns.length / 10))} /{" "}
                      {Math.ceil(campaigns.length / 10)}
                    </span>
                    <button
                      disabled={campPage >= Math.ceil(campaigns.length / 10)}
                      onClick={() =>
                        setCampPage((p) =>
                          Math.min(Math.ceil(campaigns.length / 10), p + 1)
                        )
                      }
                      className="grid place-items-center w-7 h-7 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:text-ink transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Highlight({
  tone,
  label,
  funnel,
  metric,
  sub,
  rank,
}: {
  tone: "emerald" | "orange" | "brand";
  label: string;
  funnel: Funnel | null;
  metric: (f: Funnel) => string;
  sub?: (f: Funnel) => string;
  rank?: number;
}) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-500",
    orange: "from-orange-500 to-amber-500",
    brand: "from-indigo-500 to-violet-500",
  };
  const badge: Record<string, string> = {
    emerald: "text-emerald-700 bg-emerald-100",
    orange: "text-orange-700 bg-orange-100",
    brand: "text-brand-700 bg-brand-100",
  };
  return (
    <div className="card card-pad relative overflow-hidden">
      <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full bg-gradient-to-br ${tones[tone]} opacity-[0.08]`} />
      <div className="flex items-center gap-1.5">
        <span className="stat-label">{label}</span>
        {rank && (
          <span className={`text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${badge[tone]}`}>
            prioridade {rank}
          </span>
        )}
      </div>
      {funnel ? (
        <>
          <div className="text-[22px] font-black tracking-tight text-ink mt-1.5 leading-none">
            {metric(funnel)}
          </div>
          <div className="text-[13px] font-semibold text-slate-600 mt-1.5 truncate" title={funnel.name}>
            {funnel.name}
          </div>
          {sub && (
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              {sub(funnel)}
            </div>
          )}
        </>
      ) : (
        <div className="text-slate-400 text-sm mt-2">—</div>
      )}
    </div>
  );
}

function MiniDonut({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: { name: string; value: number }[];
}) {
  const [page, setPage] = useState(1);
  const PER = 10;
  const total = data.reduce((s, d) => s + d.value, 0);
  const totalPages = Math.max(1, Math.ceil(data.length / PER));
  const cur = Math.min(page, totalPages);
  const pageItems = data.slice((cur - 1) * PER, cur * PER);

  return (
    <section className="card card-pad">
      <h3 className="font-bold text-ink mb-1">{title}</h3>
      <p className="text-[13px] text-slate-400 mb-3">{subtitle}</p>
      {total === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">Sem dados.</p>
      ) : (
        <>
          {/* gráfico em cima */}
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* legenda embaixo (paginada, sem scroll) */}
          <ul className="mt-3 space-y-1.5">
            {pageItems.map((d, idx) => {
              const gi = (cur - 1) * PER + idx;
              return (
                <li key={gi} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PALETTE[gi % PALETTE.length] }} />
                  <span className="text-slate-600 truncate flex-1">{d.name}</span>
                  <span className="text-ink font-semibold tabular-nums">{Math.round((d.value / total) * 100)}%</span>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <button
                disabled={cur <= 1}
                onClick={() => setPage(cur - 1)}
                className="grid place-items-center w-7 h-7 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:text-ink transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-400 tabular-nums">
                {cur} / {totalPages}
              </span>
              <button
                disabled={cur >= totalPages}
                onClick={() => setPage(cur + 1)}
                className="grid place-items-center w-7 h-7 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:text-ink transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  grad,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  grad: string;
}) {
  return (
    <div className="card card-pad">
      <div className={`grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br ${grad} text-white mb-3`}>
        <Icon className="w-4 h-4" strokeWidth={2.4} />
      </div>
      <div className="text-[22px] font-black tracking-tight text-ink leading-none">
        {value}
      </div>
      <div className="stat-label mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
