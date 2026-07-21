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
  Check,
  type LucideIcon,
} from "lucide-react";
import { pct, fmtDuration } from "@/lib/format";

type Funnel = {
  id: string;
  name: string;
  sessions: number;
  visitors: number;
  completed: number;
  ic: number;
  avgDurationMs: number | null;
  daily: { date: string; sessions: number; completed: number }[];
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

  function toggle(id: string) {
    setSelected((prev) => {
      const base = prev ?? allIds;
      return base.includes(id)
        ? base.filter((x) => x !== id)
        : [...base, id];
    });
  }

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
    const m = new Map<string, { sessions: number; completed: number }>();
    for (const f of chosen)
      for (const d of f.daily) {
        const e = m.get(d.date) || { sessions: 0, completed: 0 };
        e.sessions += d.sessions;
        e.completed += d.completed;
        m.set(d.date, e);
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

  if (funnels.length === 0) {
    return (
      <div className="card card-pad text-center py-16 text-slate-400">
        Nenhum funil ainda.
      </div>
    );
  }

  return (
    <div>
      {/* seletor de funis */}
      <div className="card card-pad mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-ink text-sm">
            Funis no cruzamento{" "}
            <span className="text-slate-400 font-semibold">
              ({chosen.length}/{funnels.length})
            </span>
          </h3>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <button
              onClick={() => setSelected(allIds)}
              className="text-brand-600 hover:underline"
            >
              Todos
            </button>
            <button
              onClick={() => setSelected([])}
              className="text-slate-400 hover:text-ink"
            >
              Limpar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {funnels.map((f, i) => {
            const on = selSet.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5 text-xs font-semibold border transition ${
                  on
                    ? "border-transparent text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:text-ink"
                }`}
                style={on ? { background: PALETTE[i % PALETTE.length] } : undefined}
              >
                <span
                  className={`grid place-items-center w-4 h-4 rounded-full ${
                    on ? "bg-white/25" : "bg-slate-100"
                  }`}
                >
                  {on && <Check className="w-3 h-3" strokeWidth={3} />}
                </span>
                <span className="max-w-[190px] truncate">{f.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {chosen.length === 0 ? (
        <div className="card card-pad text-center py-16 text-slate-400">
          Selecione ao menos um funil pra ver as métricas.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Kpi icon={Activity} label="Sessões" value={agg.sessions.toLocaleString("pt-BR")} grad="from-indigo-500 to-violet-500" />
            <Kpi icon={Users} label="Visitantes" value={agg.visitors.toLocaleString("pt-BR")} grad="from-sky-500 to-cyan-500" />
            <Kpi icon={Target} label="Conclusão" value={pct(agg.completed, agg.sessions)} sub={`${agg.completed.toLocaleString("pt-BR")} concl.`} grad="from-emerald-500 to-teal-500" />
            <Kpi icon={ShoppingCart} label="Iniciou checkout" value={pct(agg.ic, agg.sessions)} sub={`${agg.ic.toLocaleString("pt-BR")} IC`} grad="from-orange-500 to-amber-500" />
            <Kpi icon={Clock} label="Tempo médio" value={fmtDuration(agg.avgDur)} grad="from-fuchsia-500 to-pink-500" />
          </div>

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
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-5 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-1 rounded bg-brand-600" /> Sessões</span>
              <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-1 rounded bg-emerald-500" /> Concluíram</span>
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* comparativo por funil */}
            <section className="card card-pad">
              <h3 className="font-bold text-ink mb-1">Comparativo por funil</h3>
              <p className="text-[13px] text-slate-400 mb-3">Sessões · % conclusão por funil.</p>
              <div style={{ height: Math.max(200, compare.length * 34 + 20) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={compare} margin={{ top: 4, right: 44, left: 4, bottom: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(val: any, _n, p: any) => [`${val} sessões · ${p.payload.comp}% conclusão`, p.payload.name]} />
                    <Bar dataKey="sessions" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {compare.map((c, i) => (
                        <Cell key={c.id} fill={PALETTE[funnels.findIndex((f) => f.id === c.id) % PALETTE.length]} />
                      ))}
                      <LabelList dataKey="sessions" position="right" offset={6} style={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* participação */}
            <section className="card card-pad">
              <h3 className="font-bold text-ink mb-1">Participação nas sessões</h3>
              <p className="text-[13px] text-slate-400 mb-3">Fatia de cada funil no total.</p>
              {share.length === 0 ? (
                <p className="text-sm text-slate-400 py-10 text-center">Sem sessões.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-[150px] h-[150px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={share} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={2} stroke="none" isAnimationActive={false}>
                          {share.map((s, i) => (
                            <Cell key={i} fill={PALETTE[funnels.findIndex((f) => f.name === s.name) % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex-1 min-w-0 space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                    {share.map((s, i) => {
                      const total = share.reduce((a, b) => a + b.value, 0);
                      return (
                        <li key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PALETTE[funnels.findIndex((f) => f.name === s.name) % PALETTE.length] }} />
                          <span className="text-slate-600 truncate flex-1">{s.name}</span>
                          <span className="text-ink font-semibold tabular-nums">{Math.round((s.value / total) * 100)}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
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
