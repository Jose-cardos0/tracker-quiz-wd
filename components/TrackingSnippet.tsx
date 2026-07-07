"use client";

import { useEffect, useState } from "react";

/**
 * Mostra o script de tracking do projeto (pra colar no <head> do HTML) já com
 * as configs atuais — id, endpoint, nº de etapas. Reflete o estado SALVO: como
 * a tela de settings recarrega após "Salvar", o script sai sempre atualizado.
 */
export default function TrackingSnippet({
  slug,
  totalSteps,
  appUrl,
}: {
  slug: string;
  totalSteps: number | null;
  appUrl?: string;
}) {
  const [app, setApp] = useState((appUrl || "").replace(/\/$/, ""));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!app && typeof window !== "undefined") {
      setApp(window.location.origin.replace(/\/$/, ""));
    }
  }, [app]);

  const snippet =
    `<script src="${app}/track.js"></script>\n` +
    `<script>\n` +
    `  HMTrack.init({ projectId: "${slug}", endpoint: "${app}/api/collect", totalSteps: ${
      totalSteps ?? "null"
    }, autoSteps: true });\n` +
    `</script>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div className="card card-pad mt-5">
      <p className="text-sm font-semibold text-ink mb-1">Script de tracking</p>
      <p className="text-xs text-slate-400 mb-3">
        Cole no <code className="text-[11px]">&lt;head&gt;</code> do HTML do seu
        quiz. Já vem com as configurações salvas acima.
      </p>
      <div className="relative">
        <pre className="bg-slate-900 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed">
          {snippet}
        </pre>
        <button
          onClick={copy}
          className="absolute top-2.5 right-2.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg px-2.5 py-1.5 transition"
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
