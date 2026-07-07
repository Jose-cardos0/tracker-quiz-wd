"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * Popup que aparece DEPOIS de salvar o projeto (quando a URL tem ?saved=1),
 * mostrando o script de tracking regenerado com as configs novas pra colar no
 * HTML. Fechar remove o ?saved=1 da URL pra não reabrir num refresh.
 */
export default function SavedScriptModal({
  open,
  slug,
  totalSteps,
  appUrl,
}: {
  open: boolean;
  slug: string;
  totalSteps: number | null;
  appUrl?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(open);
  const [app, setApp] = useState((appUrl || "").replace(/\/$/, ""));
  const [copied, setCopied] = useState(false);

  useEffect(() => setVisible(open), [open]);
  useEffect(() => {
    if (!app && typeof window !== "undefined") {
      setApp(window.location.origin.replace(/\/$/, ""));
    }
  }, [app]);

  if (!visible) return null;

  const snippet =
    `<script src="${app}/track.js"></script>\n` +
    `<script>\n` +
    `  HMTrack.init({ projectId: "${slug}", endpoint: "${app}/api/collect", totalSteps: ${
      totalSteps ?? "null"
    }, autoSteps: true });\n` +
    `</script>`;

  function close() {
    setVisible(false);
    router.replace(pathname); // tira o ?saved=1
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-lg card card-pad relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute top-4 right-4 text-slate-400 hover:text-ink transition"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-1">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-emerald-100 text-emerald-600">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <div className="font-bold text-ink text-lg">Salvo!</div>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Copie o script atualizado e cole de novo no{" "}
          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
            &lt;head&gt;
          </code>{" "}
          do HTML do seu quiz.
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

        <button onClick={close} className="btn-primary w-full py-2.5 mt-4">
          Entendi
        </button>
      </div>
    </div>
  );
}
