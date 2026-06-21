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
  const admin = createAdminClient();

  const { data: proj } = await admin
    .from("projects")
    .select("slug,hosting")
    .eq("id", id)
    .maybeSingle();

  if (proj?.hosting === "storage" && proj.slug) {
    await removeFolder(proj.slug);
  }

  await admin.from("events").delete().eq("project_id", id);
  await admin.from("sessions").delete().eq("project_id", id);
  await admin.from("projects").delete().eq("id", id);

  revalidatePath("/");
  redirect("/");
}
