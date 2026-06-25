import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProject,
  getOverview,
  getAnswerCompletion,
  getNumericStats,
  getAnswerAssoc,
  resolveRange,
  rangeQuery,
  type AnswerCompletionRow,
} from "@/lib/data";
import { pct } from "@/lib/format";
import RangeTabs from "@/components/RangeTabs";
import {
  Info,
  Target,
  TrendingUp,
  TrendingDown,
  Ruler,
  ListChecks,
  Share2,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

// abaixo disso, a taxa é ruído estatístico — sinalizamos mas não destacamos.
const MIN_SUPPORT = 5;
// suporte mínimo para um par de respostas valer como associação.
const ASSOC_MIN_SUPPORT = 3;

export default async function DetailedAnalysisPage({
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

  const [ov, completion, numeric, assoc] = await Promise.all([
    getOverview(project.id, from, to),
    getAnswerCompletion(project.id, from, to),
    getNumericStats(project.id, from, to),
    getAnswerAssoc(project.id, from, to, ASSOC_MIN_SUPPORT),
  ]);

  const names = (project.step_names || {}) as Record<string, string>;
  const stepName = (i: number | null) =>
    i != null ? names[String(i)] || `Etapa ${i}` : null;

  const baseline = ov.sessions ? ov.completed / ov.sessions : 0;

  // agrupa conclusão por pergunta, ordena perguntas pela etapa
  const compByQ = new Map<string, AnswerCompletionRow[]>();
  for (const r of completion) {
    const arr = compByQ.get(r.question) || [];
    arr.push(r);
    compByQ.set(r.question, arr);
  }
  const compQuestions = Array.from(compByQ.entries())
    .map(([question, rows]) => ({
      question,
      step_index: rows.reduce<number | null>(
        (m, r) => (r.step_index == null ? m : m == null ? r.step_index : Math.min(m, r.step_index)),
        null
      ),
      rows: rows
        .map((r) => ({
          ...r,
          rate: r.sessions ? r.completed / r.sessions : 0,
        }))
        .sort((a, b) => b.rate - a.rate),
    }))
    .sort((a, b) => (a.step_index ?? 1e9) - (b.step_index ?? 1e9));

  const hasData =
    compQuestions.length > 0 || numeric.length > 0 || assoc.length > 0;

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <Link
            href={`/projects/${project.id}/answers${qs}`}
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-ink transition"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Leadscore
          </Link>
          <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight mt-1">
            Análises detalhadas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {project.name} — comportamento e perfil por resposta.
          </p>
        </div>
        <RangeTabs current={range} />
      </div>

      {/* caveat */}
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 text-amber-700 px-4 py-3 text-[13px] mb-6">
        <Info className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2.2} />
        <span>
          Sem o sinal de comprador, usamos <b>concluir o quiz</b> como proxy de
          intenção. Compare valores <b>dentro</b> de cada pergunta (entre
          perguntas de etapas diferentes o número é enviesado). Amostras
          pequenas (&lt;{MIN_SUPPORT}) são ruído — aparecem em cinza.
        </span>
      </div>

      {!hasData ? (
        <div className="card card-pad text-center py-16">
          <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mb-3">
            <ListChecks className="w-6 h-6" strokeWidth={2} />
          </span>
          <p className="font-semibold text-ink">Sem dados suficientes no período</p>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Quando houver respostas capturadas, as análises de conclusão e o
            perfil do público aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ===== #1 Conclusão por resposta ===== */}
          <section>
            <div className="flex items-center gap-2 mb-1">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                <Target className="w-4 h-4" strokeWidth={2.2} />
              </span>
              <h2 className="font-bold text-ink">Conclusão por resposta</h2>
            </div>
            <p className="text-[13px] text-slate-400 mb-4 ml-9">
              Entre quem escolheu cada resposta, quantos terminaram o quiz.
              Baseline do funil:{" "}
              <b className="text-slate-600">{pct(ov.completed, ov.sessions)}</b>.
            </p>

            {compQuestions.length === 0 ? (
              <p className="text-sm text-slate-400 ml-9">Sem respostas no período.</p>
            ) : (
              <div className="space-y-4">
                {compQuestions.map((q) => {
                  const sName = stepName(q.step_index);
                  return (
                    <div key={q.question} className="card card-pad">
                      <div className="flex items-center gap-2 mb-3">
                        {q.step_index != null && (
                          <span className="grid place-items-center min-w-6 h-6 px-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-extrabold tabular-nums">
                            {q.step_index}
                          </span>
                        )}
                        <h3 className="font-bold text-ink leading-tight break-words">
                          {q.question}
                        </h3>
                        {sName && q.step_index != null && q.question !== sName && (
                          <span className="text-[12px] text-slate-400 truncate">{sName}</span>
                        )}
                      </div>
                      <div className="space-y-2.5">
                        {q.rows.map((r) => {
                          const weak = r.sessions < MIN_SUPPORT;
                          const deltaPts = Math.round((r.rate - baseline) * 100);
                          const up = deltaPts > 0;
                          return (
                            <div key={r.value_label} className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-3 mb-1">
                                  <span className="text-[13px] font-semibold text-slate-700 truncate" title={r.value_label}>
                                    {r.value_label}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0 tabular-nums">
                                    {!weak && deltaPts !== 0 && (
                                      <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold rounded-full px-1.5 py-0.5 ${up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {up ? "+" : ""}{deltaPts} pts
                                      </span>
                                    )}
                                    <span className={`text-[13px] ${weak ? "text-slate-300" : "text-slate-500"}`}>
                                      <b className={weak ? "text-slate-400" : "text-ink"}>
                                        {Math.round(r.rate * 100)}%
                                      </b>{" "}
                                      <span className="text-slate-300">({r.sessions})</span>
                                    </span>
                                  </div>
                                </div>
                                <div className="h-5 rounded-lg bg-slate-50 ring-1 ring-slate-100 overflow-hidden">
                                  <div
                                    className={`h-full rounded-lg transition-all duration-500 ${
                                      weak
                                        ? "bg-slate-200"
                                        : up
                                        ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                                        : "bg-gradient-to-r from-slate-300 to-slate-400"
                                    }`}
                                    style={{ width: `${Math.max(r.rate * 100, 3)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ===== #3 Perfil numérico do público ===== */}
          {numeric.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-1">
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 text-white">
                  <Ruler className="w-4 h-4" strokeWidth={2.2} />
                </span>
                <h2 className="font-bold text-ink">Perfil do público</h2>
              </div>
              <p className="text-[13px] text-slate-400 mb-4 ml-9">
                Respostas numéricas (peso, altura, idade, meta…) — quem é o seu
                lead típico.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {numeric.map((s) => (
                  <div key={s.question} className="card card-pad">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="font-bold text-ink leading-tight break-words">
                        {s.question}
                      </h3>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        n={s.n}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[28px] font-black tracking-tight text-ink leading-none">
                        {fmtNum(s.median)}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">mediana</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 text-[12px]">
                      <Metric label="Média" value={fmtNum(s.avg)} />
                      <Metric label="Faixa típica" value={`${fmtNum(s.p25)}–${fmtNum(s.p75)}`} />
                      <Metric label="Mínimo" value={fmtNum(s.min_val)} />
                      <Metric label="Máximo" value={fmtNum(s.max_val)} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== #2 Associação entre respostas ===== */}
          {assoc.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-1">
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                  <Share2 className="w-4 h-4" strokeWidth={2.2} />
                </span>
                <h2 className="font-bold text-ink">Associação entre respostas</h2>
              </div>
              <p className="text-[13px] text-slate-400 mb-4 ml-9">
                Respostas que aparecem <b>juntas mais que o acaso</b> (lift &gt; 1).
                Útil pra montar perfis e ângulos de copy.
              </p>
              <div className="space-y-2.5">
                {assoc.map((p, i) => {
                  const liftStr = p.lift.toFixed(1).replace(".", ",");
                  const conf = Math.round(p.confidence * 100);
                  const strong = p.lift >= 1.5;
                  return (
                    <div
                      key={`${p.q_a}|${p.v_a}|${p.q_b}|${p.v_b}|${i}`}
                      className="card card-pad"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="inline-flex flex-col">
                            <span className="text-[13px] font-bold text-ink leading-tight">{p.v_a}</span>
                            <span className="text-[11px] text-slate-400 leading-tight">{p.q_a}</span>
                          </span>
                          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                          <span className="inline-flex flex-col">
                            <span className="text-[13px] font-bold text-ink leading-tight">{p.v_b}</span>
                            <span className="text-[11px] text-slate-400 leading-tight">{p.q_b}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-[12px] font-extrabold tabular-nums rounded-full px-2 py-0.5 ${
                              strong
                                ? "bg-violet-100 text-violet-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {liftStr}×
                          </span>
                          <span className="text-[12px] text-slate-500 tabular-nums">
                            {conf}% também marcam{" "}
                            <span className="text-slate-300">(n={p.both})</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-700 tabular-nums">{value}</span>
    </div>
  );
}
