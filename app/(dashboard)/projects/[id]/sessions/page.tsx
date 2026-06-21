import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, getSessions, windowFromRange } from "@/lib/data";
import { fmtDate, fmtDuration, flag } from "@/lib/format";
import RangeTabs from "@/components/RangeTabs";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
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

  const sessions = await getSessions(project.id, from, to, 200);
  const total = project.total_steps || 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <Link
            href={`/projects/${project.id}?range=${range}`}
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-ink transition"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            {project.name}
          </Link>
          <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight mt-1">
            Sessões
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Últimas {sessions.length} sessões no período.
          </p>
        </div>
        <RangeTabs current={range} />
      </div>

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
              {sessions.map((s) => {
                const prog = total ? Math.round((s.max_step / total) * 100) : 0;
                const src =
                  (s.utm && (s.utm.utm_source || s.utm.utm_campaign)) ||
                  (s.cid ? `cid:${s.cid}` : null) ||
                  "(direto)";
                return (
                  <tr
                    key={s.session_id}
                    className="border-t border-slate-100 hover:bg-slate-50/60 transition"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {fmtDate(s.started_at)}
                    </td>
                    <td className="py-3 px-4 max-w-[180px] truncate text-slate-700" title={src}>
                      {src}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {flag(s.country)}{" "}
                      <span className="text-slate-400 text-xs">{s.device}</span>
                    </td>
                    <td className="py-3 px-4 w-44">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[70px]">
                          <div
                            className={`h-full rounded-full ${
                              s.completed ? "bg-emerald-500" : "bg-brand-500"
                            }`}
                            style={{ width: `${Math.max(prog, 4)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {s.max_step}/{total || "?"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-600">
                      {fmtDuration(s.duration_ms)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {s.completed ? (
                        <span className="pill-green">Concluiu</span>
                      ) : (
                        <span className="pill-slate">Abandonou</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/projects/${project.id}/sessions/${s.session_id}`}
                        className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                      >
                        Detalhe
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhuma sessão no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
