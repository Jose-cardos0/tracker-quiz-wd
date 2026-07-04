"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { purgeProject } from "@/lib/purge";

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

export async function deleteProject(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  await purgeProject(id);
  revalidatePath("/");
  redirect("/");
}
