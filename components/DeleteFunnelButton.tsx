"use client";

import { Trash2 } from "lucide-react";
import { deleteProject } from "@/app/(dashboard)/projects/[id]/actions";

export default function DeleteFunnelButton({
  id,
  name,
  className = "",
}: {
  id: string;
  name: string;
  className?: string;
}) {
  return (
    <form
      action={deleteProject}
      onSubmit={(e) => {
        if (
          !confirm(
            `Excluir "${name}"? Isso apaga o funil e TODOS os dados de tracking dele. Não dá pra desfazer.`
          )
        )
          e.preventDefault();
      }}
      className={className}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        title="Excluir funil"
        aria-label="Excluir funil"
        className="grid place-items-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 shadow-sm transition hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </form>
  );
}
