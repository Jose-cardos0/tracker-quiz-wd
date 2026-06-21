import { NextRequest, NextResponse } from "next/server";
import { unzipSync } from "fflate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  detectTotalSteps,
  detectName,
  injectTracker,
  contentTypeFor,
  normalizeSlug,
} from "@/lib/quiz-inject";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "quizzes";

export async function POST(req: NextRequest) {
  // --- auth ---------------------------------------------------------------
  const supa = createSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // --- parse form ---------------------------------------------------------
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Form inválido" }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  const folderFiles = form.getAll("files") as File[];
  const pathsRaw = (form.get("paths") as string) || "";
  const nameInput = (form.get("name") as string) || "";
  const slugInput = (form.get("slug") as string) || "";
  const typeInput = (form.get("type") as string) || "quiz";
  const totalStepsInput = (form.get("totalSteps") as string) || "";
  const autoSteps = (form.get("autoSteps") as string) !== "false";

  if (!file && !folderFiles.length) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }
  const slug = normalizeSlug(slugInput || nameInput);
  if (!slug) {
    return NextResponse.json({ error: "Slug/nome inválido" }, { status: 400 });
  }

  // re-root a set of files so that index.html sits at the top level
  function rerootToIndex(
    raw: Record<string, Uint8Array>
  ): Record<string, Uint8Array> | null {
    const htmls = Object.keys(raw).filter(
      (p) => /(^|\/)index\.html?$/i.test(p) && !p.endsWith("/")
    );
    if (!htmls.length) return null;
    const indexPath = htmls.sort((a, b) => a.length - b.length)[0];
    const base = indexPath.replace(/index\.html?$/i, ""); // dir prefix
    const out: Record<string, Uint8Array> = {};
    for (const [p, data] of Object.entries(raw)) {
      if (p.endsWith("/")) continue;
      if (base && !p.startsWith(base)) continue;
      const rel = base ? p.slice(base.length) : p;
      if (rel) out[rel] = data;
    }
    return out;
  }

  // --- collect files (folder | zip | single html) -------------------------
  let files: Record<string, Uint8Array> = {};

  if (folderFiles.length) {
    // folder upload: paths carry each file's path relative to the folder root
    let paths: string[] = [];
    try {
      paths = JSON.parse(pathsRaw);
    } catch {
      return NextResponse.json({ error: "Caminhos inválidos" }, { status: 400 });
    }
    const raw: Record<string, Uint8Array> = {};
    for (let i = 0; i < folderFiles.length; i++) {
      const rel = (paths[i] || folderFiles[i].name).replace(/^\/+/, "");
      if (!rel || rel.endsWith("/")) continue;
      raw[rel] = new Uint8Array(await folderFiles[i].arrayBuffer());
    }
    const rerooted = rerootToIndex(raw);
    if (!rerooted) {
      return NextResponse.json(
        { error: "A pasta precisa conter um index.html" },
        { status: 400 }
      );
    }
    files = rerooted;
  } else if (
    file!.name.toLowerCase().endsWith(".zip") ||
    file!.type === "application/zip" ||
    file!.type === "application/x-zip-compressed"
  ) {
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(new Uint8Array(await file!.arrayBuffer()));
    } catch {
      return NextResponse.json({ error: "ZIP inválido" }, { status: 400 });
    }
    const rerooted = rerootToIndex(unzipped);
    if (!rerooted) {
      return NextResponse.json(
        { error: "ZIP precisa conter um index.html" },
        { status: 400 }
      );
    }
    files = rerooted;
  } else {
    if (!/\.html?$/i.test(file!.name)) {
      return NextResponse.json(
        { error: "Envie um .html, um .zip ou uma pasta" },
        { status: 400 }
      );
    }
    files["index.html"] = new Uint8Array(await file!.arrayBuffer());
  }

  // --- inject tracker into index.html -------------------------------------
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const endpoint = appUrl ? `${appUrl}/api/collect` : "/api/collect";
  let html = new TextDecoder().decode(files["index.html"]);
  const detected = detectTotalSteps(html);
  const totalSteps =
    totalStepsInput && !isNaN(+totalStepsInput) ? +totalStepsInput : detected;
  const name = nameInput.trim() || detectName(html, slug);
  html = injectTracker(html, { slug, endpoint, totalSteps, autoSteps });
  files["index.html"] = new TextEncoder().encode(html);

  // --- ensure bucket + upload --------------------------------------------
  const admin = createAdminClient();
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  for (const [rel, data] of Object.entries(files)) {
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(`${slug}/${rel}`, data, {
        contentType: contentTypeFor(rel),
        upsert: true,
      });
    if (error) {
      return NextResponse.json(
        { error: `Falha ao subir ${rel}: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // --- register / update project -----------------------------------------
  const { data: proj, error: dbErr } = await admin
    .from("projects")
    .upsert(
      {
        slug,
        name,
        type: typeInput === "page" ? "page" : "quiz",
        total_steps: totalSteps,
        hosting: "storage",
        storage_path: slug,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select("id")
    .maybeSingle();

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    slug,
    projectId: proj?.id,
    totalSteps,
    fileCount: Object.keys(files).length,
  });
}
