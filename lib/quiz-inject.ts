// Server-side helpers to prepare an uploaded quiz/page for tracking.

/** Best-effort count of quiz steps from the HTML markup. */
export function detectTotalSteps(html: string): number | null {
  // 1) explicit data-step="N" — take the highest numeric value
  const nums = new Set<number>();
  const re = /data-step\s*=\s*["']?(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) nums.add(parseInt(m[1], 10));
  if (nums.size) return Math.max(...nums);

  // 2) elements with class "step"
  const stepClass = html.match(/class\s*=\s*["'][^"']*\bstep\b[^"']*["']/gi);
  if (stepClass && stepClass.length > 1) return stepClass.length;

  // 3) data-step without number (count occurrences)
  const dataStep = html.match(/data-step/gi);
  if (dataStep && dataStep.length > 1) return dataStep.length;

  return null;
}

/** Pull a friendly name from <title>, fallback to the slug. */
export function detectName(html: string, slug: string): string {
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = t && t[1] ? t[1].trim() : "";
  return title || slug;
}

export type InjectOpts = {
  slug: string;
  endpoint: string;
  totalSteps: number | null;
  autoSteps: boolean;
  autoAnswers?: boolean;
};

/** Insert the HMTrack snippet into <head> (idempotent). */
export function injectTracker(html: string, opts: InjectOpts): string {
  if (html.includes("HMTrack.init(")) return html; // already instrumented

  // Uploads não costumam instrumentar respostas na mão -> liga a auto-captura
  // por padrão (data-val / data-multi / data-answer). Ver public/track.js.
  const autoAnswers = opts.autoAnswers !== false;

  const init = `HMTrack.init({ projectId: ${JSON.stringify(
    opts.slug
  )}, endpoint: ${JSON.stringify(opts.endpoint)}, totalSteps: ${
    opts.totalSteps ?? "null"
  }, autoSteps: ${opts.autoSteps ? "true" : "false"}, autoAnswers: ${
    autoAnswers ? "true" : "false"
  } });`;

  const snippet = `\n<!-- HMTrack (injetado automaticamente) -->\n<script src="/track.js"></script>\n<script>${init}</script>\n`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (h) => h + snippet);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (h) => h + "<head>" + snippet + "</head>");
  }
  return snippet + html;
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return TYPES[ext] || "application/octet-stream";
}

/** Normalise a user-supplied slug. */
export function normalizeSlug(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
