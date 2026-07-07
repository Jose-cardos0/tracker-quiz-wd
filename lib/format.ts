export function fmtDuration(ms: number | null | undefined): string {
  if (!ms || ms < 0) return "0s";
  const s = Math.round(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function pct(part: number, total: number): string {
  if (!total) return "0%";
  return Math.round((part / total) * 100) + "%";
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Deriva a origem a partir do domínio do referrer (fallback quando não há utm). */
export function sourceFromReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  let host = "";
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    host = String(referrer).toLowerCase();
  }
  if (/facebook|fb\.com|fb\.watch|\bfb\b/.test(host)) return "facebook";
  if (/instagram/.test(host)) return "instagram";
  if (/youtube|youtu\.be/.test(host)) return "youtube";
  if (/google/.test(host)) return "google";
  if (/tiktok/.test(host)) return "tiktok";
  if (/bing/.test(host)) return "bing";
  if (/t\.co|twitter|x\.com/.test(host)) return "twitter";
  if (/whatsapp|wa\.me/.test(host)) return "whatsapp";
  if (host) return host; // outro domínio: mostra o próprio host
  return null;
}

/** Origem da sessão: utm_source -> referrer -> (direto). */
export function inferSource(
  utm: Record<string, string> | null | undefined,
  referrer: string | null | undefined
): string {
  const s = utm && utm.utm_source;
  if (s) return s;
  return sourceFromReferrer(referrer) || "(direto)";
}
