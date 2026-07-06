import Link from "next/link";
import {
  getProjects,
  getProject,
  getOverview,
  getFunnel,
  getTiming,
  getCampaigns,
  resolveRange,
} from "@/lib/data";
import RangeTabs from "@/components/RangeTabs";
import CompareView from "@/components/CompareView";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { ids?: string; range?: string; from?: string; to?: string };
}) {
  const ids = (searchParams.ids || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const { from, to, key: range } = resolveRange(searchParams);

  const allProjects = await getProjects();

  const cols = (
    await Promise.all(
      ids.map(async (id) => {
        const project = await getProject(id);
        if (!project) return null;
        const [ov, funnel, timing, campaigns] = await Promise.all([
          getOverview(id, from, to),
          getFunnel(id, from, to),
          getTiming(id, from, to),
          getCampaigns(id, from, to),
        ]);
        return {
          project: {
            id: project.id,
            name: project.name,
            slug: project.slug,
            total_steps: project.total_steps,
            step_names: project.step_names,
          },
          ov,
          funnel,
          timing,
          campaigns,
        };
      })
    )
  ).filter(Boolean);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-ink transition">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Funis
          </Link>
          <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight mt-1">
            Comparar funis
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Expanda uma seção e ela abre em todas as colunas.
          </p>
        </div>
        <RangeTabs current={range} />
      </div>

      <CompareView
        cols={cols as any}
        allProjects={allProjects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
