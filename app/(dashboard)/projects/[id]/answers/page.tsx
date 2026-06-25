import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProject,
  getFunnel,
  getAnswerStats,
  getAnswerQuestions,
  resolveRange,
  rangeQuery,
  type AnswerStatRow,
} from "@/lib/data";
import { pct } from "@/lib/format";
import RangeTabs from "@/components/RangeTabs";
import { ListChecks, CheckCircle2, ListPlus, Type, Info } from "lucide-react";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, { label: string; icon: typeof CheckCircle2 }> = {
  single: { label: "Resposta única", icon: CheckCircle2 },
  multi: { label: "Múltipla escolha", icon: ListPlus },
  text: { label: "Texto livre", icon: Type },
};

export default async function AnswersPage({
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

  const [questions, stats, funnel] = await Promise.all([
    getAnswerQuestions(project.id, from, to),
    getAnswerStats(project.id, from, to),
    getFunnel(project.id, from, to),
  ]);

  const names = (project.step_names || {}) as Record<string, string>;
  const stepName = (i: number | null) =>
    i != null ? names[String(i)] || `Etapa ${i}` : null;

  // sessions that reached each step (denominador da taxa de resposta)
  const reachMap = new Map(funnel.map((f) => [f.step_index, f.sessions_reached]));

  // group value distribution by question
  const byQuestion = new Map<string, AnswerStatRow[]>();
  for (const row of stats) {
    const arr = byQuestion.get(row.question) || [];
    arr.push(row);
    byQuestion.set(row.question, arr);
  }

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <Link
            href={`/projects/${project.id}${qs}`}
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-ink transition"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            {project.name}
          </Link>
          <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight mt-1">
            Leadscore
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quais respostas dominam cada pergunta e a taxa de resposta por etapa.
          </p>
        </div>
        <RangeTabs current={range} />
      </div>

      {/* nota: o score por comprador entra depois */}
      <div className="flex items-start gap-2.5 rounded-xl bg-brand-50 text-brand-700 px-4 py-3 text-[13px] mb-6">
        <Info className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2.2} />
        <span>
          Esta é a <b>análise de respostas</b> — a base do leadscore. A pontuação
          por <b>comprador</b> (quais respostas mais convertem) é ligada quando o
          checkout for conectado.
        </span>
      </div>

      {questions.length === 0 ? (
        <div className="card card-pad text-center py-16">
          <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mb-3">
            <ListChecks className="w-6 h-6" strokeWidth={2} />
          </span>
          <p className="font-semibold text-ink">Sem respostas no período ainda</p>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Assim que os leads responderem ao quiz, cada pergunta aparece aqui com
            a distribuição das respostas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const values = byQuestion.get(q.question) || [];
            const top = Math.max(1, ...values.map((v) => v.responses));
            const reached =
              q.step_index != null ? reachMap.get(q.step_index) ?? null : null;
            const meta = q.kind ? KIND_LABEL[q.kind] : undefined;
            const KindIcon = meta?.icon;
            const sName = stepName(q.step_index);

            return (
              <section key={q.question} className="card card-pad">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {q.step_index != null && (
                        <span className="grid place-items-center min-w-6 h-6 px-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-extrabold tabular-nums">
                          {q.step_index}
                        </span>
                      )}
                      <h2 className="font-bold text-ink leading-tight break-words">
                        {q.question}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[12px] text-slate-400">
                      {sName && q.step_index != null && q.question !== sName && (
                        <span className="truncate">{sName}</span>
                      )}
                      {meta && KindIcon && (
                        <span className="inline-flex items-center gap-1">
                          <KindIcon className="w-3.5 h-3.5" strokeWidth={2.2} />
                          {meta.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13px] tabular-nums text-slate-500">
                      <b className="text-ink">{q.sessions.toLocaleString("pt-BR")}</b>{" "}
                      {q.sessions === 1 ? "resposta" : "respostas"}
                    </div>
                    {reached != null && reached > 0 && (
                      <div className="text-[12px] text-slate-400 tabular-nums mt-0.5">
                        taxa {pct(q.sessions, reached)}{" "}
                        <span className="text-slate-300">
                          ({reached.toLocaleString("pt-BR")} chegaram)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* distribuição de valores */}
                <div className="space-y-2">
                  {values.map((v, i) => {
                    const w = (v.responses / top) * 100;
                    const share = q.sessions
                      ? Math.round((v.responses / q.sessions) * 100)
                      : 0;
                    const leader = i === 0;
                    return (
                      <div key={v.value_label} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="text-[13px] font-semibold text-slate-700 truncate" title={v.value_label}>
                              {v.value_label}
                            </span>
                            <span className="text-[12px] tabular-nums text-slate-400 shrink-0">
                              <b className="text-ink">{v.responses.toLocaleString("pt-BR")}</b>{" "}
                              · {share}%
                            </span>
                          </div>
                          <div className="h-6 rounded-lg bg-slate-50 ring-1 ring-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-lg transition-all duration-500 ${
                                leader
                                  ? "bg-gradient-to-r from-brand-400 to-brand-600"
                                  : "bg-gradient-to-r from-slate-300 to-slate-400"
                              }`}
                              style={{ width: `${Math.max(w, 3)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {values.length === 0 && (
                    <p className="text-sm text-slate-400 py-2">
                      Respostas registradas, mas sem valor legível.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
