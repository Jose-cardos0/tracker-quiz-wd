import {
  getProjects,
  getOverview,
  getCheckoutCount,
  getDailyStats,
  resolveRange,
} from "@/lib/data";
import RangeTabs from "@/components/RangeTabs";
import DashboardClient from "@/components/DashboardClient";
import { LayoutDashboard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const { from, to, key: range } = resolveRange(searchParams);
  const projects = await getProjects();

  const funnels = await Promise.all(
    projects.map(async (p) => {
      const [ov, ic, daily] = await Promise.all([
        getOverview(p.id, from, to),
        getCheckoutCount(p.id, from, to),
        getDailyStats(p.id, from, to),
      ]);
      return {
        id: p.id,
        name: p.name,
        sessions: ov.sessions,
        visitors: ov.visitors,
        completed: ov.completed,
        ic,
        avgDurationMs: ov.avg_duration_ms,
        daily,
      };
    })
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-brand-50 text-brand-600">
              <LayoutDashboard className="w-5 h-5" strokeWidth={2.2} />
            </span>
            <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight">
              Dashboard geral
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Métricas de todos os funis juntos — selecione quais cruzar.
          </p>
        </div>
        <RangeTabs current={range} />
      </div>

      <DashboardClient funnels={funnels} />
    </div>
  );
}
