import Link from "next/link";
import { getProjects, getOverview, windowFromRange, liveUrl } from "@/lib/data";
import { pct } from "@/lib/format";
import DeleteFunnelButton from "@/components/DeleteFunnelButton";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await getProjects();
  const { from, to } = windowFromRange("30d");

  const withStats = await Promise.all(
    projects.map(async (p) => ({
      project: p,
      ov: await getOverview(p.id, from, to),
    }))
  );

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight">
            Seus funis
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Desempenho dos últimos 30 dias.
          </p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="card card-pad text-center py-16">
          <div className="mx-auto grid place-items-center w-12 h-12 rounded-xl bg-brand-50 text-brand-600 mb-4">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <h3 className="font-bold text-ink">Nenhum funil ainda</h3>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            Suba seu primeiro quiz ou página para começar a trackear.
          </p>
          <Link href="/new" className="btn-brand">
            Adicionar quiz
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {withStats.map(({ project: p, ov }) => {
            const conv = pct(ov.completed, ov.sessions);
            return (
              <div key={p.id} className="relative group">
                <Link
                  href={`/projects/${p.id}`}
                  className="block card card-pad transition hover:shadow-cardhover hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-2 pr-9">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink truncate">{p.name}</span>
                        <span
                          className={p.type === "page" ? "pill-amber" : "pill-slate"}
                        >
                          {p.type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono truncate">
                        {liveUrl(p)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
                    <Stat label="Sessões" value={ov.sessions.toLocaleString("pt-BR")} />
                    <Stat
                      label="Visitantes"
                      value={ov.visitors.toLocaleString("pt-BR")}
                    />
                    <Stat label="Conclusão" value={conv} accent />
                  </div>
                </Link>

                <DeleteFunnelButton
                  id={p.id}
                  name={p.name}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className={`text-[22px] font-black tracking-tight ${
          accent ? "text-brand-600" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="stat-label mt-0.5">{label}</div>
    </div>
  );
}
