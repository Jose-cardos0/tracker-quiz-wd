import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory slug->uuid cache (per serverless instance) to avoid a lookup
// on every batch.
const projectCache = new Map<string, { id: string; total: number | null }>();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Bots da Meta (revisão de anúncio / crawlers) e automação em geral. Mesmo
// que o track.js os ignore no cliente, aqui é a rede de segurança no servidor:
// descartamos o batch sem gravar nada. NÃO casa com o navegador in-app do
// Facebook (FBAN/FBAV), que é usuário real.
const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|meta-externalagent|facebookcatalog|bingpreview|headless|lighthouse|phantom|puppeteer|playwright|selenium|semrush|ahrefs|petalbot|baiduspider|yandex|whatsapp|telegram|skypeuripreview|google-inspectiontool/i;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: corsHeaders() });
  }

  const { projectId, visitorId, sessionId, context, events } = body || {};
  if (!projectId || !visitorId || !sessionId || !Array.isArray(events)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: corsHeaders() });
  }

  // Descarta tráfego de bot (revisão de anúncio da Meta, crawlers, headless)
  // antes de qualquer escrita — assim não conta como sessão/visitante.
  const ua = req.headers.get("user-agent") || (context && context.ua) || "";
  if (BOT_RE.test(ua)) {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }

  const admin = createAdminClient();

  // --- resolve project (accepts uuid or slug) ------------------------------
  let proj = projectCache.get(projectId);
  if (!proj) {
    const col = UUID_RE.test(projectId) ? "id" : "slug";
    let { data } = await admin
      .from("projects")
      .select("id,total_steps")
      .eq(col, projectId)
      .maybeSingle();

    // Auto-register: first event from an unknown slug creates the project,
    // so dropping a new quiz folder (with the tracker snippet) is enough —
    // no manual DB insert needed. The dashboard name can be edited later.
    if (!data && col === "slug") {
      const total =
        context && typeof context.totalSteps === "number"
          ? context.totalSteps
          : null;
      await admin
        .from("projects")
        .insert({ slug: projectId, name: projectId, type: "quiz", total_steps: total })
        .select("id")
        .maybeSingle();
      const res = await admin
        .from("projects")
        .select("id,total_steps")
        .eq("slug", projectId)
        .maybeSingle();
      data = res.data;
    }

    if (!data) {
      // Unknown id (uuid) — silently drop (don't leak which ids exist).
      return new NextResponse(null, { status: 204, headers: corsHeaders() });
    }
    proj = { id: data.id, total: data.total_steps };
    projectCache.set(projectId, proj);
  }

  // --- geo / device from Vercel headers (GDPR: no raw IP stored) ----------
  const country =
    req.headers.get("x-vercel-ip-country") ||
    (context && context.country) ||
    null;
  const device = (context && context.device) || null;

  // --- fold batch aggregates ----------------------------------------------
  let maxStep = 0;
  let addDur = 0;
  let completed = false;
  let startedAt: string | null = null;

  // Respostas: deduplica por pergunta dentro do lote (último ts vence). O upsert
  // no banco resolve a dedup entre lotes/visitas. Os eventos crus continuam
  // sendo gravados em `events` (histórico).
  const answerMap = new Map<string, any>();

  const rows = events.map((e: any) => {
    if (
      (e.type === "step_view" || e.type === "reached_last") &&
      typeof e.step_index === "number"
    ) {
      maxStep = Math.max(maxStep, e.step_index);
    }
    if (e.type === "step_exit" && typeof e.duration_ms === "number") {
      addDur += Math.max(0, Math.min(e.duration_ms, 1000 * 60 * 30)); // cap 30min
    }
    if (e.type === "quiz_complete") completed = true;
    if (e.type === "session_start") {
      startedAt = e.ts ? new Date(e.ts).toISOString() : null;
    }
    if (
      e.type === "answer" &&
      e.meta &&
      e.meta.question != null &&
      String(e.meta.question).trim() !== ""
    ) {
      const q = String(e.meta.question).slice(0, 120);
      const answeredAt = e.ts
        ? new Date(e.ts).toISOString()
        : new Date().toISOString();
      const prev = answerMap.get(q);
      if (!prev || answeredAt >= prev.answered_at) {
        answerMap.set(q, {
          question: q,
          value: e.meta.value ?? null,
          step_index: typeof e.step_index === "number" ? e.step_index : null,
          kind: e.meta.kind != null ? String(e.meta.kind).slice(0, 20) : null,
          answered_at: answeredAt,
        });
      }
    }
    return {
      project_id: proj!.id,
      session_id: sessionId,
      visitor_id: visitorId,
      type: String(e.type || "custom").slice(0, 40),
      step_index: typeof e.step_index === "number" ? e.step_index : null,
      step_name: e.step_name ? String(e.step_name).slice(0, 120) : null,
      duration_ms:
        typeof e.duration_ms === "number" ? Math.round(e.duration_ms) : null,
      meta: e.meta ?? null,
      url: e.url ? String(e.url).slice(0, 500) : null,
      created_at: e.ts ? new Date(e.ts).toISOString() : new Date().toISOString(),
    };
  });

  // --- upsert visitor + session (atomic) ----------------------------------
  const { error: rpcErr } = await admin.rpc("apply_ingest", {
    p_session: sessionId,
    p_visitor: visitorId,
    p_project: proj.id,
    p_utm: context?.utm ?? null,
    p_first_utm: context?.firstUtm ?? null,
    p_cid: context?.cid ?? null,
    p_referrer: context?.referrer ?? null,
    p_landing: context?.url ?? null,
    p_country: country,
    p_device: device,
    p_ua: context?.ua ? String(context.ua).slice(0, 400) : null,
    p_started: startedAt,
    p_max_step: maxStep,
    p_add_dur: addDur,
    p_completed: completed,
  });
  if (rpcErr) {
    console.error("apply_ingest error", rpcErr.message);
  }

  // --- upsert answers (deduplicated "current answer" per question) --------
  if (answerMap.size) {
    const { error: ansErr } = await admin.rpc("apply_answers", {
      p_session: sessionId,
      p_project: proj.id,
      p_visitor: visitorId,
      p_answers: Array.from(answerMap.values()),
    });
    if (ansErr) console.error("apply_answers error", ansErr.message);
  }

  // --- insert events ------------------------------------------------------
  if (rows.length) {
    const { error: evErr } = await admin.from("events").insert(rows);
    if (evErr) console.error("events insert error", evErr.message);
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
