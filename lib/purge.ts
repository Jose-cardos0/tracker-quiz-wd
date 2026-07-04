import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "quizzes";

async function removeFolder(
  admin: ReturnType<typeof createAdminClient>,
  prefix: string
) {
  const { data: entries } = await admin.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });
  if (!entries?.length) return;
  const files: string[] = [];
  for (const e of entries) {
    if ((e as any).id === null) await removeFolder(admin, `${prefix}/${e.name}`);
    else files.push(`${prefix}/${e.name}`);
  }
  if (files.length) await admin.storage.from(BUCKET).remove(files);
}

/**
 * Apaga TUDO de um projeto: arquivos no Storage (se hospedado aqui), eventos,
 * sessões, o projeto e visitantes que ficaram órfãos. Usado pela server action
 * de exclusão e pela API de exclusão da home.
 */
export async function purgeProject(id: string) {
  if (!id) throw new Error("Projeto inválido");
  const admin = createAdminClient();

  const { data: proj } = await admin
    .from("projects")
    .select("slug,hosting")
    .eq("id", id)
    .maybeSingle();

  if (proj?.hosting === "storage" && proj.slug) {
    await removeFolder(admin, proj.slug);
  }

  const { data: sess } = await admin
    .from("sessions")
    .select("visitor_id")
    .eq("project_id", id);
  const vids = Array.from(
    new Set((sess || []).map((s) => s.visitor_id).filter(Boolean))
  ) as string[];

  const e1 = await admin.from("events").delete().eq("project_id", id);
  const e2 = await admin.from("sessions").delete().eq("project_id", id);
  const e3 = await admin.from("projects").delete().eq("id", id);
  const err = e1.error || e2.error || e3.error;
  if (err) throw new Error("Falha ao excluir: " + err.message);

  // remove visitantes sem NENHUMA sessão restante (em qualquer projeto)
  if (vids.length) {
    const orphans: string[] = [];
    for (let i = 0; i < vids.length; i += 200) {
      const chunk = vids.slice(i, i + 200);
      const { data: still } = await admin
        .from("sessions")
        .select("visitor_id")
        .in("visitor_id", chunk);
      const keep = new Set((still || []).map((s) => s.visitor_id));
      chunk.forEach((v) => !keep.has(v) && orphans.push(v));
    }
    for (let i = 0; i < orphans.length; i += 200) {
      await admin
        .from("visitors")
        .delete()
        .in("visitor_id", orphans.slice(i, i + 200));
    }
  }
}
