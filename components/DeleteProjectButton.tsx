"use client";

import { deleteProject } from "@/app/(dashboard)/projects/[id]/actions";

export default function DeleteProjectButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  return (
    <form
      action={deleteProject}
      onSubmit={(e) => {
        if (
          !confirm(
            `Excluir "${name}"? Isso apaga o quiz e TODOS os dados de tracking dele. Não dá pra desfazer.`
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-sm font-semibold text-red-600 hover:text-red-700"
      >
        Excluir projeto
      </button>
    </form>
  );
}
