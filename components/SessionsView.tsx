"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { SessionRow } from "@/lib/data";
import { fmtDate, fmtDuration, inferSource } from "@/lib/format";
import CountryFlag from "@/components/CountryFlag";

const COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];
const PER_PAGE = 50;

const countryOf = (s: SessionRow) => s.country || "??";
const originOf = (s: SessionRow) => inferSource(s.utm, s.referrer);
const statusOf = (s: SessionRow) =>
  s.ic ? "Iniciou checkout" : s.completed ? "Concluiu" : "Abandonou";

function countBy<T>(arr: T[], key: (x: T) => string) {
  const m = new Map<string, number>();
  arr.forEach((x) => {
    const k = key(x);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
function topN(rows: { name: string; value: number }[], n: number) {
  if (rows.length <= n) return rows;
  const head = rows.slice(0, n);
  const rest = rows.slice(n).reduce((s, r) => s + r.value, 0);
  return rest > 0 ? [...head, { name: "outros", value: rest }] : head;
}

export default function SessionsView({
  sessions,
  projectId,
  totalSteps,
}: {
  sessions: SessionRow[];
  projectId: string;
  totalSteps: number;
}) {
  const [country, setCountry] = useState("all");
  const [origin, setOrigin] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  // Filtros persistem por projeto (localStorage): saiu e voltou, continuam.
  // Só somem quando o usuário clica "Limpar filtros" (que grava "all").
  const FKEY = `sessfilters:${projectId}`;
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FKEY);
      if (raw) {
        const f = JSON.parse(raw);
        if (f.country) setCountry(f.country);
        if (f.origin) setOrigin(f.origin);
        if (f.status) setStatus(f.status);
      }
    } catch {}
    setLoaded(true);
  }, [FKEY]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(FKEY, JSON.stringify({ country, origin, status }));
    } catch {}
  }, [loaded, FKEY, country, origin, status]);

  const countries = useMemo(
    () => Array.from(new Set(sessions.map(countryOf))).sort(),
    [sessions]
  );
  const origins = useMemo(
    () => Array.from(new Set(sessions.map(originOf))).sort(),
    [sessions]
  );

  const filtered = useMemo(
    () =>
      sessions.filter(
        (s) =>
          (country === "all" || countryOf(s) === country) &&
          (origin === "all" || originOf(s) === origin) &&
          (status === "all" ||
            (status === "ic"
              ? !!s.ic
              : status === "done"
              ? s.completed && !s.ic
              : !s.completed))
      ),
    [sessions, country, origin, status]
  );

  // charts data
  const byCountry = useMemo(() => topN(countBy(filtered, countryOf), 6), [filtered]);
  const byOrigin = useMemo(() => topN(countBy(filtered, originOf), 6), [filtered]);
  const byStatus = useMemo(() => countBy(filtered, statusOf), [filtered]);
  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((s) => {
      const d = s.started_at.slice(0, 10);
      m.set(d, (m.get(d) || 0) + 1);
    });
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, c]) => ({ date: `${d.slice(8, 10)}/${d.slice(5, 7)}`, sessions: c }));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const cur = Math.min(page, totalPages);
  const rows = filtered.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div>
      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Select
          label="País"
          value={country}
          onChange={resetPage(setCountry)}
          options={[
            { v: "all", l: "Todos os países" },
            ...countries.map((c) => ({ v: c, l: c })),
          ]}
        />
        <Select
          label="Origem"
          value={origin}
          onChange={resetPage(setOrigin)}
          options={[
            { v: "all", l: "Todas as origens" },
            ...origins.map((o) => ({ v: o, l: o })),
          ]}
        />
        <Select
          label="Status"
          value={status}
          onChange={resetPage(setStatus)}
          options={[
            { v: "all", l: "Todos os status" },
            { v: "ic", l: "Iniciou checkout" },
            { v: "done", l: "Concluiu" },
            { v: "drop", l: "Abandonou" },
          ]}
        />
        {(country !== "all" || origin !== "all" || status !== "all") && (
          <button
            onClick={() => {
              setCountry("all");
              setOrigin("all");
              setStatus("all");
              setPage(1);
            }}
            className="text-sm font-semibold text-brand-600 hover:underline px-2"
          >
            Limpar filtros
          </button>
        )}
        <span className="text-sm text-slate-400 ml-auto">
          {filtered.length.toLocaleString("pt-BR")} sessões
        </span>
      </div>

      {/* resumo em gráficos */}
      <div className="card card-pad mb-4">
        <h3 className="font-bold text-ink mb-1">Sessões por dia</h3>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={byDay} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="sFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                labelStyle={{ fontWeight: 700, color: "#0f172a" }}
              />
              <Area type="monotone" dataKey="sessions" name="Sessões" stroke="#4f46e5" strokeWidth={2.5} fill="url(#sFill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {(() => {
        const statusColor = (name: string) =>
          name === "Iniciou checkout"
            ? "#f97316"
            : name === "Concluiu"
            ? "#10b981"
            : "#94a3b8";
        return (
          <>
            {/* inline (telas normais): 3 em linha; some quando o painel fixo aparece */}
            <div className="grid sm:grid-cols-3 gap-4 mb-6 min-[1750px]:hidden">
              <Donut title="Por país" data={byCountry} />
              <Donut title="Por origem" data={byOrigin} />
              <Donut title="Por status" data={byStatus} colorFor={statusColor} />
            </div>

            {/* painel fixo à direita (telas >=1750px): 3 empilhados em vertical,
                acompanha a rolagem */}
            <aside className="hidden min-[1750px]:block fixed top-24 right-6 w-64 z-30">
              <div className="max-h-[calc(100vh-7rem)] overflow-y-auto space-y-4 pr-1 -mr-1">
                <Donut title="Por país" data={byCountry} layout="col" />
                <Donut title="Por origem" data={byOrigin} layout="col" />
                <Donut title="Por status" data={byStatus} colorFor={statusColor} layout="col" />
              </div>
            </aside>
          </>
        );
      })()}

      {/* tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wide bg-slate-50/80 border-b border-slate-100">
                <th className="py-3 px-4 font-semibold">Início</th>
                <th className="py-3 px-4 font-semibold">Origem</th>
                <th className="py-3 px-4 font-semibold">Local</th>
                <th className="py-3 px-4 font-semibold">Progresso</th>
                <th className="py-3 px-4 font-semibold text-right">Tempo</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const prog = totalSteps ? Math.round((s.max_step / totalSteps) * 100) : 0;
                return (
                  <tr key={s.session_id} className="border-t border-slate-100 hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">{fmtDate(s.started_at)}</td>
                    <td className="py-3 px-4 max-w-[160px] truncate text-slate-700">{originOf(s)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <CountryFlag code={s.country} />
                        <span className="text-slate-400 text-xs">{s.device}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 w-44">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[70px]">
                          <div className={`h-full rounded-full ${s.ic ? "bg-orange-500" : s.completed ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${Math.max(prog, 4)}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums">{s.max_step}/{totalSteps || "?"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-600">{fmtDuration(s.duration_ms)}</td>
                    <td className="py-3 px-4 text-center">
                      {s.ic ? <span className="pill-orange">IC</span> : s.completed ? <span className="pill-green">Concluiu</span> : <span className="pill-slate">Abandonou</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/projects/${projectId}/sessions/${s.session_id}`} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                        Detalhe
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhuma sessão com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-5">
          <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="text-sm font-semibold text-slate-600 disabled:opacity-40 hover:text-ink">
            ← Anterior
          </button>
          <span className="text-sm text-slate-500 tabular-nums">Página {cur} de {totalPages}</span>
          <button disabled={cur >= totalPages} onClick={() => setPage(cur + 1)} className="text-sm font-semibold text-slate-600 disabled:opacity-40 hover:text-ink">
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg pl-3 pr-1 py-1">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm text-ink bg-transparent outline-none py-1 pr-1 max-w-[160px]"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Donut({
  title,
  data,
  colorFor,
  layout = "row",
}: {
  title: string;
  data: { name: string; value: number }[];
  colorFor?: (name: string) => string;
  layout?: "row" | "col";
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const color = (name: string, i: number) =>
    colorFor ? colorFor(name) : COLORS[i % COLORS.length];
  return (
    <div className="card card-pad">
      <h3 className="font-bold text-ink mb-2">{title}</h3>
      {total === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">Sem dados.</p>
      ) : (
        <div
          className={
            layout === "col"
              ? "flex flex-col items-center gap-2"
              : "flex items-center gap-3"
          }
        >
          <div className="w-[110px] h-[110px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={32} outerRadius={52} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={color(d.name, i)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className={layout === "col" ? "w-full space-y-1" : "flex-1 min-w-0 space-y-1"}>
            {data.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color(d.name, i) }} />
                <span className="text-slate-600 truncate flex-1">{d.name}</span>
                <span className="text-ink font-semibold tabular-nums">
                  {Math.round((d.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
