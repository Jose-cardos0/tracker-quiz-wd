import { NextRequest, NextResponse } from "next/server";
import {
  getProjects,
  getOverview,
  windowFromRange,
  liveUrl,
} from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { purgeProject } from "@/lib/purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  const s = createSupabaseServerClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  return user;
}

// Lista dos funis + métricas (30d) — consumida pela home (loading/busca/paginação).
export async function GET() {
  if (!(await requireUser()))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const projects = await getProjects();
  const { from, to } = windowFromRange("30d");

  const items = await Promise.all(
    projects.map(async (p) => {
      const ov = await getOverview(p.id, from, to);
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        type: p.type,
        url: liveUrl(p),
        sessions: ov.sessions,
        visitors: ov.visitors,
        completed: ov.completed,
      };
    })
  );

  return NextResponse.json({ items });
}

// Exclusão da home (apaga tudo no Supabase + Storage) sem recarregar a página.
export async function DELETE(req: NextRequest) {
  if (!(await requireUser()))
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  try {
    await purgeProject(id);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Falha" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
