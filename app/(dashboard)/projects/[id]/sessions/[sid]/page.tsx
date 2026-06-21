import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProject,
  getSession,
  getSessionEvents,
  type EventRow,
} from "@/lib/data";
import { fmtDate, fmtDuration, flag } from "@/lib/format";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  session_start: "Início da sessão",
  step_view: "Entrou na etapa",
  reached_last: "Chegou na última etapa",
  click: "Clique",
  answer: "Resposta",
  quiz_complete: "Concluiu o quiz",
  checkout_redirect: "Foi para o checkout",
};

const TYPE_COLOR: Record<string, string> = {
  session_start: "bg-slate-300",
  step_view: "bg-brand-500",
  click: "bg-sky-400",
  answer: "bg-violet-400",
  quiz_complete: "bg-emerald-500",
  checkout_redirect: "bg-emerald-600",
  reached_last: "bg-emerald-500",
};

export default async function SessionDetailPage({
  params,
}: {
  params: { id: string; sid: string };
}) {
  const [project, session, events] = await Promise.all([
    getProject(params.id),
    getSession(params.sid),
    getSessionEvents(params.sid),
  ]);
  if (!project || !session) notFound();

  const exitByStep = new Map<number, number>();
  for (const e of events) {
    if (e.type === "step_exit" && e.step_index != null && e.duration_ms != null) {
      exitByStep.set(e.step_index, e.duration_ms);
    }
  }
  const timeline = events.filter((e) => e.type !== "step_exit");

  const names = (project.step_names || {}) as Record<string, string>;
  const stepName = (i: number | null) =>
    i == null ? "" : names[String(i)] || `Etapa ${i}`;

  const src =
    (session.utm &&
      Object.entries(session.utm)
        .map(([k, v]) => `${k}=${v}`)
        .join("  ")) ||
    "(direto)";

  return (
    <div>
      <Link
        href={`/projects/${project.id}/sessions`}
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-ink transition"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Sessões
      </Link>
      <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight mt-1 mb-1">
        Sessão
      </h1>
      <p className="text-xs text-slate-400 mb-6 font-mono">{session.session_id}</p>

      {/* attribution */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <Meta label="Início" value={fmtDate(session.started_at)} />
        <Meta
          label="Local / dispositivo"
          value={`${flag(session.country)} ${session.country || "?"} · ${session.device || "?"}`}
        />
        <Meta
          label="Progresso"
          value={`Etapa ${session.max_step}/${project.total_steps || "?"}`}
        />
        <Meta label="Status" value={session.completed ? "✓ Concluiu" : "Abandonou"} />
        <Meta label="Tempo total" value={fmtDuration(session.duration_ms)} />
        <Meta label="Visitante" value={session.visitor_id.slice(0, 8) + "…"} />
        <Meta label="cid" value={session.cid || "—"} />
        <Meta label="Atribuição" value={src} wide />
      </div>

      {/* timeline */}
      <div className="card card-pad">
        <h2 className="font-bold text-ink mb-5">Trilha do usuário</h2>
        <ol className="relative border-l-2 border-slate-100 ml-2">
          {timeline.map((e) => (
            <TimelineItem
              key={e.id}
              e={e}
              stepName={stepName}
              dwell={
                e.type === "step_view" && e.step_index != null
                  ? exitByStep.get(e.step_index)
                  : undefined
              }
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

function TimelineItem({
  e,
  stepName,
  dwell,
}: {
  e: EventRow;
  stepName: (i: number | null) => string;
  dwell?: number;
}) {
  const color = TYPE_COLOR[e.type] || "bg-slate-300";
  const label = TYPE_LABEL[e.type] || e.type;

  let detail: string | null = null;
  if (e.type === "step_view") detail = stepName(e.step_index);
  else if (e.type === "answer" && e.meta)
    detail = `${e.meta.question}: ${e.meta.value}`;
  else if (e.type === "click" && e.meta)
    detail = e.meta.text || e.meta.id || e.meta.cls || "(elemento)";

  return (
    <li className="ml-5 pb-5 last:pb-0">
      <span
        className={`absolute -left-[7px] w-3 h-3 rounded-full ring-2 ring-white ${color}`}
      />
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="text-sm font-semibold text-ink">{label}</span>
          {detail && <span className="text-sm text-slate-500"> — {detail}</span>}
          {e.type === "click" && e.step_index != null && (
            <span className="text-xs text-slate-300"> (etapa {e.step_index})</span>
          )}
        </div>
        <div className="text-xs text-slate-400 whitespace-nowrap tabular-nums">
          {new Date(e.created_at).toLocaleTimeString("pt-BR")}
          {dwell != null && (
            <span className="ml-2 text-slate-600 font-semibold">{fmtDuration(dwell)}</span>
          )}
        </div>
      </div>
    </li>
  );
}

function Meta({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`card px-4 py-3 ${wide ? "sm:col-span-2 lg:col-span-4" : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="text-sm font-semibold text-ink mt-0.5 break-words">{value}</div>
    </div>
  );
}
