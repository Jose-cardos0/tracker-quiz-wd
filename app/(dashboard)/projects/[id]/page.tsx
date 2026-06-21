import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProject,
  getOverview,
  getFunnel,
  getTiming,
  getCampaigns,
  windowFromRange,
  liveUrl,
} from "@/lib/data";
import { fmtDuration, pct } from "@/lib/format";
import { buildInsights } from "@/lib/insights";
import RangeTabs from "@/components/RangeTabs";
import Collapsible from "@/components/Collapsible";
import FunnelChart from "@/components/FunnelChart";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { range?: string };
}) {
  const range = searchParams.range || "30d";
  const { from, to } = windowFromRange(range);

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
            Abrir ↗
          </a>
          <Link href={`/projects/${project.id}/settings`} className="btn-ghost text-sm">
            Editar
          </Link>
          <Link
            href={`/projects/${project.id}/sessions?range=${range}`}
            className="btn-primary text-sm h-9"
          >
            Ver sessões
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <RangeTabs current={range} />
      </div>

      {/* overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <Card label="Sessões" value={ov.sessions.toLocaleString("pt-BR")} />
        <Card label="Visitantes únicos" value={ov.visitors.toLocaleString("pt-BR")} />
        <Card
          label="Taxa de conclusão"
          value={pct(ov.completed, ov.sessions)}
          sub={`${ov.completed} concluíram`}
          accent
        />
        <Card label="Tempo médio" value={fmtDuration(ov.avg_duration_ms)} />
      </div>

      {/* line chart: retention vs time */}
      <section className="card card-pad mb-6">
        <h2 className="font-bold text-ink">Relação entre as etapas</h2>
        <p className="text-[13px] text-slate-400 mb-2">
          Retenção × tempo gasto — onde o funil perde gente e onde prende.
        </p>
        <FunnelChart data={chartData} />
      </section>

      {/* mini report */}
      <section className="card card-pad mb-6">
        <h2 className="font-bold text-ink">Relatório rápido</h2>
        <p className="text-[13px] text-slate-400 mb-4">Leitura automática do funil.</p>
        {insights.length === 0 ? (
          <p className="text-sm text-slate-400">
            Sem dados suficientes para gerar o relatório.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {insights.map((it, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    it.tone === "good"
                      ? "bg-emerald-500"
                      : it.tone === "warn"
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                />
                <span className="text-slate-700">{it.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* funnel */}
      <Collapsible
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
          <div className="space-y-2">
            {funnel.map((row, idx) => {
              const reached = row.sessions_reached;
              const widthPct = base ? (reached / base) * 100 : 0;
              const prev = idx > 0 ? funnel[idx - 1].sessions_reached : reached;
              const dropPct = prev ? Math.round(((prev - reached) / prev) * 100) : 0;
              const isWorst = row.step_index === worstDrop.step && worstDrop.lost > 0;
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
                        {reached.toLocaleString("pt-BR")}
                        <span className="text-slate-300"> · </span>
                        {pct(reached, base)}
                        {idx > 0 && dropPct > 0 && (
                          <span
                            className={
                              isWorst
                                ? "text-rose-600 font-bold ml-2"
                                : "text-slate-400 ml-2"
                            }
                          >
                            −{dropPct}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isWorst ? "bg-rose-400" : "bg-brand-500"
                        }`}
                        style={{ width: `${Math.max(widthPct, 1.5)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
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

function Card({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card card-pad">
      <div
        className={`text-[26px] font-black tracking-tight ${
          accent ? "text-brand-600" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="stat-label mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-slate-400 py-4">Sem dados nesse período ainda.</p>;
}
