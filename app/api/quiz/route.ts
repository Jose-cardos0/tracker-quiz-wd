import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeSlug } from "@/lib/quiz-inject";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "quizzes";

async function removeFolder(admin: ReturnType<typeof createAdminClient>, prefix: string) {
  const { data: entries } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (!entries?.length) return;
  const files: string[] = [];
  for (const e of entries) {
    if ((e as any).id === null) await removeFolder(admin, `${prefix}/${e.name}`);
    else files.push(`${prefix}/${e.name}`);
  }
  if (files.length) await admin.storage.from(BUCKET).remove(files);
}

export async function POST(req: NextRequest) {
  // --- auth ---------------------------------------------------------------
  const supa = createSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const slug = normalizeSlug(String(body.slug || ""));
  if (!slug) return NextResponse.json({ error: "Slug inválido" }, { status: 400 });

  const admin = createAdminClient();

  // --- sign: prepara o bucket e gera 1 URL assinada por arquivo -----------
  if (body.action === "sign") {
    const paths: string[] = Array.isArray(body.paths) ? body.paths : [];
    if (!paths.length)
      return NextResponse.json({ error: "Sem arquivos" }, { status: 400 });

    await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {});
    await removeFolder(admin, slug); // limpa versão anterior (republish limpo)

    const signed: { rel: string; path: string; token: string }[] = [];
    for (const rel of paths) {
      const clean = String(rel).replace(/^\/+/, "");
      if (!clean || clean.includes("..")) continue;
      const objPath = `${slug}/${clean}`;
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(objPath);
      if (error || !data) {
        return NextResponse.json(
          { error: `Falha ao assinar ${clean}: ${error?.message}` },
          { status: 500 }
        );
      }
      signed.push({ rel: clean, path: data.path, token: data.token });
    }
    return NextResponse.json({ ok: true, signed });
  }

  // --- register: cria/atualiza o projeto ----------------------------------
  if (body.action === "register" || body.action === "register-external") {
    const total =
      typeof body.totalSteps === "number"
        ? body.totalSteps
        : body.totalSteps && !isNaN(+body.totalSteps)
        ? +body.totalSteps
        : null;

    const external = body.action === "register-external";
    let externalUrl: string | null = null;
    if (external) {
      externalUrl = String(body.externalUrl || "").trim();
      if (!/^https?:\/\//i.test(externalUrl)) {
        return NextResponse.json(
          { error: "URL externa inválida (precisa começar com http/https)" },
          { status: 400 }
        );
      }
    }

    // Evita colisão de slug: se o slug já existe para OUTRO quiz, gera um
    // slug único (quiz-2, quiz-3...) em vez de sobrescrever e misturar dados.
    let finalSlug = slug;
    const { data: existing } = await admin
      .from("projects")
      .select("id,hosting,external_url,storage_path")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      const sameExternal =
        external &&
        existing.hosting === "external" &&
        existing.external_url === externalUrl;
      const sameUpload = !external && existing.hosting === "storage";
      if (!sameExternal && !sameUpload) {
        let n = 1;
        while (true) {
          n++;
          const cand = `${slug}-${n}`;
          const { data: taken } = await admin
            .from("projects")
            .select("id")
            .eq("slug", cand)
            .maybeSingle();
          if (!taken) {
            finalSlug = cand;
            break;
          }
        }
      }
    }

    const { data, error } = await admin
      .from("projects")
      .upsert(
        {
          slug: finalSlug,
          name: String(body.name || finalSlug),
          type: body.type === "page" ? "page" : "quiz",
          total_steps: total,
          hosting: external ? "external" : "storage",
          storage_path: external ? null : finalSlug,
          external_url: externalUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, projectId: data?.id, slug: finalSlug });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
