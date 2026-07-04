import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, getSessions, resolveRange, rangeQuery } from "@/lib/data";
import RangeTabs from "@/components/RangeTabs";
import SessionsView from "@/components/SessionsView";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
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

  const sessions = await getSessions(project.id, from, to, 1000);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <Link
            href={`/projects/${project.id}${qs}`}
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-ink transition"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            {project.name}
          </Link>
          <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight mt-1">
            Sessões
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {sessions.length.toLocaleString("pt-BR")} sessões no período
            {sessions.length >= 1000 ? " (máx. exibido)" : ""}.
          </p>
        </div>
        <RangeTabs current={range} />
      </div>

      <SessionsView
        sessions={sessions}
        projectId={project.id}
        totalSteps={project.total_steps || 0}
      />
    </div>
  );
}
