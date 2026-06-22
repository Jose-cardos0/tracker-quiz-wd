"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUser() {
  const s = createSupabaseServerClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) throw new Error("Não autenticado");
}

export async function updateProject(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const totalRaw = String(formData.get("total_steps") || "").trim();
  const total_steps = totalRaw && !isNaN(+totalRaw) ? +totalRaw : null;

  const step_names: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("step_name_")) {
      const idx = k.slice("step_name_".length);
      const val = String(v).trim();
      if (val) step_names[idx] = val;
    }
  }

  const admin = createAdminClient();
  await admin
    .from("projects")
    .update({
      name: name || undefined,
      total_steps,
      step_names: Object.keys(step_names).length ? step_names : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath(`/projects/${id}`);
  revalidatePath(`/projects/${id}/settings`);
  redirect(`/projects/${id}`);
}

async function removeFolder(prefix: string) {
  const admin = createAdminClient();
  const { data: entries } = await admin.storage
    .from("quizzes")
    .list(prefix, { limit: 1000 });
  if (!entries?.length) return;

  const files: string[] = [];
  for (const e of entries) {
    // folders come back with id === null
    if ((e as any).id === null) {
      await removeFolder(`${prefix}/${e.name}`);
    } else {
      files.push(`${prefix}/${e.name}`);
    }
  }
  if (files.length) await admin.storage.from("quizzes").remove(files);
}

export async function deleteProject(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Projeto inválido");
  const admin = createAdminClient();

  const { data: proj } = await admin
    .from("projects")
    .select("slug,hosting")
    .eq("id", id)
    .maybeSingle();

  // 1) arquivos do Storage (se hospedado aqui)
  if (proj?.hosting === "storage" && proj.slug) {
    await removeFolder(proj.slug);
  }

  // 2) coleta os visitantes deste projeto (antes de apagar as sessões)
  const { data: sess } = await admin
    .from("sessions")
    .select("visitor_id")
    .eq("project_id", id);
  const vids = Array.from(
    new Set((sess || []).map((s) => s.visitor_id).filter(Boolean))
  ) as string[];

  // 3) apaga eventos, sessões e o projeto (surfaceia erros)
  const e1 = await admin.from("events").delete().eq("project_id", id);
  const e2 = await admin.from("sessions").delete().eq("project_id", id);
  const e3 = await admin.from("projects").delete().eq("id", id);
  const err = e1.error || e2.error || e3.error;
  if (err) throw new Error("Falha ao excluir: " + err.message);

  // 4) remove visitantes que ficaram sem NENHUMA sessão (em qualquer projeto)
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
      await admin.from("visitors").delete().in("visitor_id", orphans.slice(i, i + 200));
    }
  }

  revalidatePath("/");
  redirect("/");
}
