import { createAdminClient } from "@/lib/supabase/admin";

export type Project = {
  id: string;
  slug: string;
  name: string;
  type: string;
  total_steps: number | null;
  step_names: Record<string, string> | null;
  active: boolean;
  hosting: string | null; // 'repo' | 'storage' | 'external'
  external_url: string | null;
  created_at: string;
};

/** Public URL of a project's live quiz/page (campaign link). */
export function liveUrl(
  p: Pick<Project, "slug" | "hosting" | "external_url">
): string {
  if (p.hosting === "external") return p.external_url || "#";
  if (p.hosting === "storage") return `/q/${p.slug}/`;
  return `/quizzes/${p.slug}/index.html`;
}

export type Overview = {
  sessions: number;
  visitors: number;
  completed: number;
  avg_duration_ms: number | null;
};

export type FunnelRow = { step_index: number; sessions_reached: number };
export type TimingRow = {
  step_index: number;
  avg_ms: number;
  median_ms: number;
  samples: number;
};
export type CampaignRow = {
  source: string;
  campaign: string;
  cid: string;
  sessions: number;
  completed: number;
  avg_max_step: number;
};

export type SessionRow = {
  session_id: string;
  visitor_id: string;
  utm: Record<string, string> | null;
  cid: string | null;
  referrer: string | null;
  country: string | null;
  device: string | null;
  started_at: string;
  last_event_at: string;
  max_step: number;
  duration_ms: number;
  completed: boolean;
};

export type EventRow = {
  id: number;
  type: string;
  step_index: number | null;
  step_name: string | null;
  duration_ms: number | null;
  meta: any;
  created_at: string;
};

export type AnswerStatRow = {
  question: string;
  step_index: number | null;
  kind: string | null;
  value_label: string;
  responses: number;
};

export type AnswerQuestionRow = {
  question: string;
  step_index: number | null;
  kind: string | null;
  sessions: number;
};

export type AnswerCompletionRow = {
  question: string;
  step_index: number | null;
  value_label: string;
  sessions: number;
  completed: number;
};

export type NumericStatRow = {
  question: string;
  step_index: number | null;
  n: number;
  avg: number;
  median: number;
  p25: number;
  p75: number;
  min_val: number;
  max_val: number;
};

/** Rolling window: last N days -> [from, to) ISO strings. */
export function windowFromRange(range: string): { from: string; to: string } {
  const days = range === "7d" ? 7 : range === "90d" ? 90 : range === "all" ? 3650 : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 864e5);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Resolve the active window from URL params. Explicit from/to (used by
 * "Hoje", "Ontem" and o intervalo personalizado) take priority; otherwise
 * falls back to the rolling preset. `key` drives which tab is highlighted.
 */
export function resolveRange(sp: {
  range?: string;
  from?: string;
  to?: string;
}): { from: string; to: string; key: string } {
  if (sp.from && sp.to) {
    const f = new Date(sp.from);
    const t = new Date(sp.to);
    if (!isNaN(f.getTime()) && !isNaN(t.getTime())) {
      return { from: f.toISOString(), to: t.toISOString(), key: sp.range || "custom" };
    }
  }
  const key = sp.range || "30d";
  return { ...windowFromRange(key), key };
}

/** Build the querystring that carries the current window across page links. */
export function rangeQuery(sp: {
  range?: string;
  from?: string;
  to?: string;
}): string {
  const q = new URLSearchParams();
  if (sp.range) q.set("range", sp.range);
  if (sp.from) q.set("from", sp.from);
  if (sp.to) q.set("to", sp.to);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function getProjects(): Promise<Project[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true });
  return (data as Project[]) || [];
}

export async function getProject(id: string): Promise<Project | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Project) || null;
}

export async function getOverview(
  id: string,
  from: string,
  to: string
): Promise<Overview> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("project_overview", {
    p_id: id,
    p_from: from,
    p_to: to,
  });
  const row = (data && data[0]) || {};
  return {
    sessions: Number(row.sessions || 0),
    visitors: Number(row.visitors || 0),
    completed: Number(row.completed || 0),
    avg_duration_ms: row.avg_duration_ms != null ? Number(row.avg_duration_ms) : null,
  };
}

export async function getFunnel(
  id: string,
  from: string,
  to: string
): Promise<FunnelRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("project_funnel", {
    p_id: id,
    p_from: from,
    p_to: to,
  });
  return ((data as any[]) || []).map((r) => ({
    step_index: Number(r.step_index),
    sessions_reached: Number(r.sessions_reached),
  }));
}

export async function getTiming(
  id: string,
  from: string,
  to: string
): Promise<TimingRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("project_step_timing", {
    p_id: id,
    p_from: from,
    p_to: to,
  });
  return ((data as any[]) || []).map((r) => ({
    step_index: Number(r.step_index),
    avg_ms: Number(r.avg_ms || 0),
    median_ms: Number(r.median_ms || 0),
    samples: Number(r.samples || 0),
  }));
}

export async function getCampaigns(
  id: string,
  from: string,
  to: string
): Promise<CampaignRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("project_campaigns", {
    p_id: id,
    p_from: from,
    p_to: to,
  });
  return ((data as any[]) || []).map((r) => ({
    source: r.source || "(direto)",
    campaign: r.campaign || "",
    cid: r.cid || "",
    sessions: Number(r.sessions || 0),
    completed: Number(r.completed || 0),
    avg_max_step: Number(r.avg_max_step || 0),
  }));
}

export async function getSessions(
  id: string,
  from: string,
  to: string,
  limit = 100
): Promise<SessionRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sessions")
    .select(
      "session_id,visitor_id,utm,cid,referrer,country,device,started_at,last_event_at,max_step,duration_ms,completed"
    )
    .eq("project_id", id)
    .gte("started_at", from)
    .lt("started_at", to)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data as SessionRow[]) || [];
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sessions")
    .select(
      "session_id,visitor_id,utm,cid,referrer,country,device,started_at,last_event_at,max_step,duration_ms,completed"
    )
    .eq("session_id", sessionId)
    .maybeSingle();
  return (data as SessionRow) || null;
}

/** Per-question + per-value answer distribution (base do leadscore). */
export async function getAnswerStats(
  id: string,
  from: string,
  to: string
): Promise<AnswerStatRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("project_answer_stats", {
    p_id: id,
    p_from: from,
    p_to: to,
  });
  return ((data as any[]) || []).map((r) => ({
    question: r.question,
    step_index: r.step_index != null ? Number(r.step_index) : null,
    kind: r.kind ?? null,
    value_label: r.value_label,
    responses: Number(r.responses || 0),
  }));
}

/** Per-question summary: step, kind, distinct sessions that answered. */
export async function getAnswerQuestions(
  id: string,
  from: string,
  to: string
): Promise<AnswerQuestionRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("project_answer_questions", {
    p_id: id,
    p_from: from,
    p_to: to,
  });
  return ((data as any[]) || []).map((r) => ({
    question: r.question,
    step_index: r.step_index != null ? Number(r.step_index) : null,
    kind: r.kind ?? null,
    sessions: Number(r.sessions || 0),
  }));
}

/** #1 Conclusão por resposta: entre quem escolheu cada valor, % que concluiu. */
export async function getAnswerCompletion(
  id: string,
  from: string,
  to: string
): Promise<AnswerCompletionRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("project_answer_completion", {
    p_id: id,
    p_from: from,
    p_to: to,
  });
  return ((data as any[]) || []).map((r) => ({
    question: r.question,
    step_index: r.step_index != null ? Number(r.step_index) : null,
    value_label: r.value_label,
    sessions: Number(r.sessions || 0),
    completed: Number(r.completed || 0),
  }));
}

/** #3 Perfil numérico: estatísticas das respostas numéricas do público. */
export async function getNumericStats(
  id: string,
  from: string,
  to: string
): Promise<NumericStatRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("project_numeric_stats", {
    p_id: id,
    p_from: from,
    p_to: to,
  });
  return ((data as any[]) || []).map((r) => ({
    question: r.question,
    step_index: r.step_index != null ? Number(r.step_index) : null,
    n: Number(r.n || 0),
    avg: Number(r.avg || 0),
    median: Number(r.median || 0),
    p25: Number(r.p25 || 0),
    p75: Number(r.p75 || 0),
    min_val: Number(r.min_val || 0),
    max_val: Number(r.max_val || 0),
  }));
}

export async function getSessionEvents(sessionId: string): Promise<EventRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("id,type,step_index,step_name,duration_ms,meta,created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(2000);
  return (data as EventRow[]) || [];
}
