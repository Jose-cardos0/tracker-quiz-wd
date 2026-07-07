import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, liveUrl } from "@/lib/data";
import { updateProject } from "../actions";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import SavedScriptModal from "@/components/SavedScriptModal";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { saved?: string };
}) {
  const project = await getProject(params.id);
  if (!project) notFound();

  const saved = searchParams?.saved === "1";

  const total = project.total_steps || 0;
  const names = (project.step_names || {}) as Record<string, string>;
  const steps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="max-w-xl mx-auto">
      <Link
        href={`/projects/${project.id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-ink transition"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        {project.name}
      </Link>
      <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight mt-1 mb-6">
        Editar projeto
      </h1>

      <form action={updateProject} className="card card-pad space-y-5">
        <input type="hidden" name="id" value={project.id} />

        <div>
          <label className="label">Nome</label>
          <input name="name" defaultValue={project.name} className="input" />
        </div>

        <div className="flex items-end gap-4">
          <div>
            <label className="label">Nº de etapas</label>
            <input
              name="total_steps"
              defaultValue={total || ""}
              inputMode="numeric"
              className="input w-28"
            />
          </div>
          <div className="text-xs text-slate-400 pb-2.5">
            slug: <b className="text-slate-600 font-mono">/{project.slug}</b>
            <span className="mx-1.5">·</span>
            <span className={project.hosting === "storage" ? "pill-green" : "pill-slate"}>
              {project.hosting || "repo"}
            </span>
          </div>
        </div>

        {total > 0 && (
          <div>
            <label className="label">Nomes das etapas (rótulos no funil)</label>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 -mr-1">
              {steps.map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-6 text-right text-xs font-bold text-slate-300 tabular-nums">
                    {i}
                  </span>
                  <input
                    name={`step_name_${i}`}
                    defaultValue={names[String(i)] || ""}
                    placeholder={`Etapa ${i}`}
                    className="input flex-1 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Deixe vazio para usar “Etapa N”. Em quizzes com detecção automática,
              os nomes também chegam pelos títulos das telas.
            </p>
          </div>
        )}

        <button type="submit" className="btn-primary w-full py-3">
          Salvar
        </button>
      </form>

      <SavedScriptModal
        open={saved}
        slug={project.slug}
        totalSteps={project.total_steps ?? null}
        appUrl={process.env.NEXT_PUBLIC_APP_URL}
      />

      <div className="flex items-center justify-between mt-5 px-1">
        <a
          href={liveUrl(project)}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Abrir quiz ↗
        </a>
        <DeleteProjectButton id={project.id} name={project.name} />
      </div>
    </div>
  );
}
