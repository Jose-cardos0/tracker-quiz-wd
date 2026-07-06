"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Trophy, Clock, TrendingDown, ArrowUpRight } from "lucide-react";
import { fmtDuration } from "@/lib/format";
import type { Overview, FunnelRow, TimingRow } from "@/lib/data";

type Col = {
  project: { id: string; name: string; url: string; total_steps: number | null };
  ov: Overview;
  funnel: FunnelRow[];
  timing: TimingRow[];
};

export default function CompareInsights({
  cols,
  colorOf,
  show = "all",
}: {
  cols: Col[];
  colorOf: (i: number) => string;
  show?: "all" | "verdict" | "charts";
}) {
  if (cols.length < 2) return null;
  const showVerdict = show !== "charts";
  const showCharts = show !== "verdict";

  // rótulo único por funil (desambigua nomes iguais)
  const label = (c: Col, i: number) => {
    const dup = cols.filter((x) => x.project.name === c.project.name).length > 1;
    return dup ? `${c.project.name} (${i + 1})` : c.project.name;
  };

  const metrics = cols.map((c, i) => {
    const rate = c.ov.sessions ? c.ov.completed / c.ov.sessions : 0;
    return {
      i,
      id: c.project.id,
      label: label(c, i),
      url: c.project.url,
      color: colorOf(i),
      sessions: c.ov.sessions,
      completion: rate,
      avgMs: c.ov.avg_duration_ms || 0,
    };
  });

  const withSessions = metrics.filter((m) => m.sessions > 0);
  const bestConv = withSessions.slice().sort((a, b) => b.completion - a.completion)[0];
  const bestTime = metrics.slice().sort((a, b) => b.avgMs - a.avgMs)[0];
  const worstConv = withSessions.slice().sort((a, b) => a.completion - b.completion)[0];

  // linha: retenção por etapa (uma linha por funil)
  const maxSteps = Math.max(
    ...cols.map((c) => (c.funnel.length ? c.funnel[c.funnel.length - 1].step_index : 0))
  );
  const lineData: any[] = [];
  for (let step = 1; step <= maxSteps; step++) {
    const row: any = { step };
    cols.forEach((c) => {
      const base = c.funnel[0]?.sessions_reached || 0;
      const r = c.funnel.find((f) => f.step_index === step);
      row[c.project.id] = base && r ? Math.round((r.sessions_reached / base) * 100) : null;
    });
    lineData.push(row);
  }

  // colunas: conclusão × abandono
  const barData = metrics.map((m) => ({
    name: m.label,
    conclusao: Math.round(m.completion * 100),
    abandono: Math.round((1 - m.completion) * 100),
  }));

  // pizza: participação de sessões
  const pieData = metrics.map((m) => ({ name: m.label, value: m.sessions }));

  return (
    <div className={showCharts && !showVerdict ? "mt-6" : "mb-6"}>
      {showVerdict && (
        <>
          {/* veredito */}
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <Verdict
              icon={<Trophy className="w-5 h-5" />}
              grad="from-amber-400 to-amber-600"
              title="Mais converteu"
              name={bestConv?.label || "—"}
              url={bestConv?.url}
              detail={bestConv ? `${Math.round(bestConv.completion * 100)}% chegam ao fim` : "sem dados"}
            />
            <Verdict
              icon={<Clock className="w-5 h-5" />}
              grad="from-indigo-400 to-violet-600"
              title="Mais prendeu atenção"
              name={bestTime?.label || "—"}
              url={bestTime?.url}
              detail={bestTime ? `${fmtDuration(bestTime.avgMs)} em média` : "sem dados"}
            />
            <Verdict
              icon={<TrendingDown className="w-5 h-5" />}
              grad="from-rose-400 to-rose-600"
              title="Mais abandono"
              name={worstConv?.label || "—"}
              url={worstConv?.url}
              detail={worstConv ? `${Math.round((1 - worstConv.completion) * 100)}% abandonam` : "sem dados"}
            />
          </div>
        </>
      )}

      {showCharts && (
       <>
      {/* linha: retenção por etapa */}
      <div className="card card-pad mb-4">
        <h3 className="font-bold text-ink mb-1">Retenção por etapa</h3>
        <p className="text-[13px] text-slate-400 mb-3">
          % de sessões que alcançaram cada etapa — quanto mais alto e reto, melhor.
        </p>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
              <XAxis dataKey="step" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={42} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {cols.map((c, i) => (
                <Line
                  key={c.project.id}
                  type="monotone"
                  dataKey={c.project.id}
                  name={label(c, i)}
                  stroke={colorOf(i)}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* colunas: conclusão x abandono */}
        <div className="card card-pad">
          <h3 className="font-bold text-ink mb-3">Conclusão × abandono</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} interval={0} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={42} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="conclusao" name="Conclusão" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="abandono" name="Abandono" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* pizza: sessões por funil */}
        <div className="card card-pad">
          <h3 className="font-bold text-ink mb-3">Participação de sessões</h3>
          <div className="flex items-center gap-3">
            <div className="w-[150px] h-[150px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={2} stroke="none" isAnimationActive={false}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={colorOf(i)} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 min-w-0 space-y-1.5">
              {metrics.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: m.color }} />
                  <span className="text-slate-600 truncate flex-1">{m.label}</span>
                  <span className="text-ink font-semibold tabular-nums">{m.sessions.toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* frase do analista (fechamento) */}
      {bestConv && worstConv && bestConv.id !== worstConv.id && (
        <div className="card card-pad mt-4 text-[13.5px] text-slate-700 leading-relaxed">
          <Trophy className="inline w-4 h-4 text-amber-500 mr-1 align-[-2px]" />
          <b>{bestConv.label}</b> é o que mais converte (
          <b className="text-emerald-600">{Math.round(bestConv.completion * 100)}%</b> até o fim)
          {bestTime && bestTime.avgMs > 0 && (
            <>
              , enquanto <b>{bestTime.label}</b> é o que mais prende atenção (
              {fmtDuration(bestTime.avgMs)} por sessão)
            </>
          )}
          . Já <b>{worstConv.label}</b> tem o maior abandono (
          <b className="text-rose-600">{Math.round((1 - worstConv.completion) * 100)}%</b> saem antes do fim) — vale
          revisar as primeiras etapas dele.
        </div>
      )}
      </>
      )}
    </div>
  );
}

function Verdict({
  icon,
  grad,
  title,
  name,
  url,
  detail,
}: {
  icon: React.ReactNode;
  grad: string;
  title: string;
  name: string;
  url?: string;
  detail: string;
}) {
  return (
    <div className="card card-pad flex items-center gap-3">
      <span className={`grid place-items-center w-11 h-11 rounded-xl text-white bg-gradient-to-br ${grad} shadow-sm shrink-0`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="stat-label">{title}</div>
        <div className="font-black text-ink truncate">{name}</div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-600 hover:underline inline-flex items-center gap-0.5 max-w-full"
          >
            <span className="truncate">{url}</span>
            <ArrowUpRight className="w-3 h-3 shrink-0" />
          </a>
        )}
        <div className="text-xs text-slate-400 truncate">{detail}</div>
      </div>
    </div>
  );
}
