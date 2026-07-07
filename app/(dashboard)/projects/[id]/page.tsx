import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProject,
  getOverview,
  getFunnel,
  getTiming,
  getCampaigns,
  resolveRange,
  rangeQuery,
  liveUrl,
} from "@/lib/data";
import { fmtDuration, pct } from "@/lib/format";
import { buildInsights } from "@/lib/insights";
import RangeTabs from "@/components/RangeTabs";
import Collapsible from "@/components/Collapsible";
import FunnelChart from "@/components/FunnelChart";
import FunnelBars from "@/components/FunnelBars";
import FloatingStepBars from "@/components/FloatingStepBars";
import FloatingRetentionChart from "@/components/FloatingRetentionChart";
import {
  Activity,
  Users,
  Target,
  Clock,
  LineChart,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Filter,
  Timer,
  Megaphone,
  ArrowUpRight,
  Pencil,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const { from, to, key: range } = resolveRange(searchParams);
  const qs = rangeQuery(searchParams);

  const project = await getProject(params.id);
  if (!project) notFound();

  const [ov, funnel, timing, campaigns] = await Promise.all([
    getOverview(project.id, from, to),
    getFunnel(project.id, from, to),
    getTiming(project.id, from, to),
    getCampaigns(project.id, from, to),
  ]);

  const names = (project.step_names || {}) as Record<string, string>;
  const stepName = (i: number) => names[String(i)] || `Etapa ${i}`;
  const base = funnel.length ? funnel[0].sessions_reached : 0;
  const timingMap = new Map(timing.map((t) => [t.step_index, t]));
  const maxMedian = Math.max(1, ...timing.map((t) => t.median_ms));

  let worstDrop = { step: 0, lost: 0, pct: 0 };
  for (let i = 1; i < funnel.length; i++) {
    const prev = funnel[i - 1].sessions_reached;
    const lost = prev - funnel[i].sessions_reached;
    if (lost > worstDrop.lost)
      worstDrop = {
        step: funnel[i].step_index,
        lost,
        pct: prev ? Math.round((lost / prev) * 100) : 0,
      };
  }

  // chart: retention (%) vs median time (s) per step
  const chartData = funnel.map((r) => ({
    step: r.step_index,
    name: stepName(r.step_index),
    retention: base ? Math.round((r.sessions_reached / base) * 100) : 0,
    time: Math.round((timingMap.get(r.step_index)?.median_ms || 0) / 1000),
    people: r.sessions_reached,
  }));

  const insights = buildInsights({
    funnel,
    timing,
    sessions: ov.sessions,
    completed: ov.completed,
    stepName,
  });

  const slowest = timing.reduce(
    (a, t) => (t.median_ms > a ? t.median_ms : a),
    0
  );

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-ink transition"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Funis
          </Link>
          <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight mt-1">
            {project.name}
          </h1>
          <div className="text-xs text-slate-400 font-mono mt-1">
            {liveUrl(project)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={liveUrl(project)} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
            <ArrowUpRight className="w-4 h-4" /> Abrir
          </a>
          <Link href={`/projects/${project.id}/settings`} className="btn-ghost text-sm">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </Link>
          <Link
            href={`/projects/${project.id}/sessions${qs}`}
            className="btn-ghost text-sm"
          >
            Ver sessões
          </Link>
          <Link
            href={`/projects/${project.id}/answers${qs}`}
            className="btn-primary text-sm h-9"
          >
            <ListChecks className="w-4 h-4" /> Leadscore
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <RangeTabs current={range} />
      </div>

      {/* overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard
          icon={Activity}
          label="Sessões"
          value={ov.sessions.toLocaleString("pt-BR")}
          grad="from-indigo-500 to-violet-500"
        />
        <StatCard
          icon={Users}
          label="Visitantes únicos"
          value={ov.visitors.toLocaleString("pt-BR")}
          grad="from-sky-500 to-cyan-500"
        />
        <StatCard
          icon={Target}
          label="Taxa de conclusão"
          value={pct(ov.completed, ov.sessions)}
          sub={`${ov.completed} concluíram`}
          grad="from-emerald-500 to-teal-500"
        />
        <StatCard
          icon={Clock}
          label="Tempo médio"
          value={fmtDuration(ov.avg_duration_ms)}
          grad="from-amber-500 to-orange-500"
        />
      </div>

      {/* painel flutuante (telas largas): relação entre etapas em pé, à esquerda */}
      <FloatingRetentionChart data={chartData} />

      {/* line chart: retention vs time — some quando o painel flutuante
          aparece (telas >=1750px) */}
      <section className="card card-pad mb-6 relative overflow-hidden min-[1750px]:hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 opacity-[0.06]" />
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand-50 text-brand-600">
            <LineChart className="w-4 h-4" strokeWidth={2.2} />
          </span>
          <h2 className="font-bold text-ink">Relação entre as etapas</h2>
        </div>
        <p className="text-[13px] text-slate-400 mb-3 mt-0.5">
          Retenção × tempo gasto — onde o funil perde gente e onde prende.
        </p>
        <FunnelChart data={chartData} />
      </section>

      {/* painel flutuante (telas largas): pessoas por etapa em pé, sticky */}
      <FloatingStepBars data={chartData} />

      {/* bar chart: pessoas por etapa (contagem absoluta) — some quando o
          painel flutuante aparece (telas >=1750px) */}
      <section className="card card-pad mb-6 relative overflow-hidden min-[1750px]:hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 opacity-[0.06]" />
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand-50 text-brand-600">
            <Users className="w-4 h-4" strokeWidth={2.2} />
          </span>
          <h2 className="font-bold text-ink">Pessoas por etapa</h2>
        </div>
        <p className="text-[13px] text-slate-400 mb-3 mt-0.5">
          Quantas sessões alcançaram cada etapa — o volume real em cada ponto do
          funil.
        </p>
        <FunnelBars data={chartData} />
      </section>

      {/* mini report */}
      <section className="card card-pad mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 text-white">
            <Sparkles className="w-4 h-4" strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="font-bold text-ink leading-tight">Relatório rápido</h2>
            <p className="text-[12px] text-slate-400">Leitura automática do funil</p>
          </div>
        </div>
        {insights.length === 0 ? (
          <p className="text-sm text-slate-400">
            Sem dados suficientes para gerar o relatório.
          </p>
        ) : (
          <ul className="space-y-2">
            {insights.map((it, i) => {
              const Icon =
                it.tone === "good"
                  ? CheckCircle2
                  : it.tone === "warn"
                  ? AlertTriangle
                  : AlertOctagon;
              const tints =
                it.tone === "good"
                  ? "bg-emerald-50 text-emerald-600"
                  : it.tone === "warn"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-rose-50 text-rose-600";
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 transition"
                >
                  <span
                    className={`mt-0.5 grid place-items-center w-6 h-6 rounded-lg shrink-0 ${tints}`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
                  </span>
                  <span className="text-[13.5px] text-slate-700 leading-relaxed">
                    {it.text}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* funnel */}
      <Collapsible
        icon={<Filter className="w-4 h-4" strokeWidth={2.2} />}
        title="Funil por etapa"
        subtitle="Sessões que alcançaram cada etapa"
        summary={
          worstDrop.lost > 0 ? (
            <span className="text-rose-600 font-semibold">
              −{worstDrop.pct}% na etapa {worstDrop.step}
            </span>
          ) : null
        }
      >
        {funnel.length === 0 ? (
          <Empty />
        ) : (
          <div className="relative pl-1">
            {/* connecting timeline line behind the badges */}
            <div className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-slate-100 rounded" />
            <div className="space-y-3">
              {funnel.map((row, idx) => {
                const reached = row.sessions_reached;
                const widthPct = base ? (reached / base) * 100 : 0;
                const retPct = base ? Math.round((reached / base) * 100) : 0;
                const prev = idx > 0 ? funnel[idx - 1].sessions_reached : reached;
                const dropPct = prev
                  ? Math.round(((prev - reached) / prev) * 100)
                  : 0;
                const isWorst =
                  row.step_index === worstDrop.step && worstDrop.lost > 0;
                return (
                  <div key={row.step_index} className="relative flex items-center gap-3.5">
                    <div
                      className={`relative z-10 w-8 h-8 shrink-0 rounded-full grid place-items-center text-xs font-extrabold ring-4 ring-white ${
                        isWorst
                          ? "bg-rose-100 text-rose-600"
                          : "bg-brand-50 text-brand-600"
                      }`}
                    >
                      {row.step_index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="text-[13px] font-semibold text-slate-700 truncate">
                          {stepName(row.step_index)}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {idx > 0 && dropPct > 0 && (
                            <span
                              className={`text-[11px] font-bold rounded-full px-1.5 py-0.5 ${
                                isWorst
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              −{dropPct}%
                            </span>
                          )}
                          <span className="text-[13px] tabular-nums text-slate-400">
                            <b className="text-ink">
                              {reached.toLocaleString("pt-BR")}
                            </b>{" "}
                            · {retPct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-7 rounded-lg bg-slate-50 ring-1 ring-slate-100 overflow-hidden relative">
                        <div
                          className={`h-full rounded-lg transition-all duration-500 ${
                            isWorst
                              ? "bg-gradient-to-r from-rose-400 to-rose-500"
                              : "bg-gradient-to-r from-brand-400 to-brand-600"
                          }`}
                          style={{ width: `${Math.max(widthPct, 3)}%` }}
                        />
                        {retPct >= 16 && (
                          <span className="absolute inset-y-0 left-2.5 flex items-center text-[11px] font-bold text-white/95">
                            {retPct}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {worstDrop.lost > 0 && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-rose-50 text-rose-700 px-4 py-3 text-[13px]">
            <svg viewBox="0 0 24 24" className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            <span>
              Maior abandono na <b>etapa {worstDrop.step}</b> ({stepName(worstDrop.step)})
              — {worstDrop.lost} sessões perdidas.
            </span>
          </div>
        )}
      </Collapsible>

      {/* timing */}
      <Collapsible
        icon={<Timer className="w-4 h-4" strokeWidth={2.2} />}
        title="Tempo por etapa"
        subtitle="Mediana de tempo gasto em cada etapa"
        summary={slowest > 0 ? <>máx {fmtDuration(slowest)}</> : null}
      >
        {timing.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {funnel.map((row) => {
              const t = timingMap.get(row.step_index);
              const median = t?.median_ms || 0;
              const w = (median / maxMedian) * 100;
              return (
                <div key={row.step_index} className="flex items-center gap-3">
                  <div className="w-6 text-right text-xs font-bold text-slate-300 tabular-nums">
                    {row.step_index}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span className="font-semibold text-slate-700 truncate">
                        {stepName(row.step_index)}
                      </span>
                      <span className="text-slate-500 tabular-nums shrink-0 pl-3">
                        {fmtDuration(median)}
                        {t ? <span className="text-slate-300 ml-2">({t.samples})</span> : null}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-700"
                        style={{ width: `${Math.max(w, 1.5)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Collapsible>

      {/* campaigns */}
      <Collapsible
        icon={<Megaphone className="w-4 h-4" strokeWidth={2.2} />}
        title="Campanhas"
        subtitle="Origem das sessões (UTM / cid)"
        summary={
          campaigns.length ? (
            <>
              {campaigns.length} {campaigns.length === 1 ? "origem" : "origens"}
            </>
          ) : null
        }
      >
        {campaigns.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wide">
                  <th className="py-2 px-2 font-semibold">Origem</th>
                  <th className="py-2 px-2 font-semibold">Campanha</th>
                  <th className="py-2 px-2 font-semibold">cid</th>
                  <th className="py-2 px-2 font-semibold text-right">Sessões</th>
                  <th className="py-2 px-2 font-semibold text-right">Concluiu</th>
                  <th className="py-2 px-2 font-semibold text-right">Etapa média</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-2.5 px-2 font-semibold text-ink">{c.source}</td>
                    <td className="py-2.5 px-2 text-slate-600">{c.campaign || "—"}</td>
                    <td className="py-2.5 px-2 text-slate-500 font-mono text-xs">{c.cid || "—"}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{c.sessions}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">
                      {c.completed}{" "}
                      <span className="text-slate-400">({pct(c.completed, c.sessions)})</span>
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{c.avg_max_step}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Collapsible>
    </div>
  );
}

function StatCard({
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
    <div className="card card-pad relative overflow-hidden">
      <div
        className={`absolute -right-5 -top-5 w-20 h-20 rounded-full bg-gradient-to-br ${grad} opacity-10`}
      />
      <span
        className={`grid place-items-center w-9 h-9 rounded-xl text-white bg-gradient-to-br ${grad} shadow-sm mb-3`}
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={2.2} />
      </span>
      <div className="text-[26px] font-black tracking-tight text-ink leading-none">
        {value}
      </div>
      <div className="stat-label mt-1.5">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-slate-400 py-4">Sem dados nesse período ainda.</p>;
}
