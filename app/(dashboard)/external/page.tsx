"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { normalizeSlug } from "@/lib/quiz-inject";

function deriveSlug(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname
      .split("/")
      .filter(Boolean)
      .filter((p) => !/index\.html?$/i.test(p) && !/\.html?$/i.test(p));
    return normalizeSlug(parts[parts.length - 1] || u.hostname.replace(/\./g, "-"));
  } catch {
    return "";
  }
}

export default function ExternalQuizPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    snippet: string;
    projectId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function onUrl(v: string) {
    setUrl(v);
    setError(null);
    if (!slug) {
      const s = deriveSlug(v);
      if (s) setSlug(s);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url)) {
      setError("Informe a URL completa (com https://)");
      return;
    }
    const finalSlug = normalizeSlug(slug || deriveSlug(url));
    if (!finalSlug) {
      setError("Slug inválido");
      return;
    }
    setBusy(true);
    setError(null);

    const total = steps && !isNaN(+steps) ? +steps : null;
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register-external",
          slug: finalSlug,
          name: name.trim() || finalSlug,
          type: "quiz",
          totalSteps: total,
          externalUrl: url.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Falha ao registrar");
        setBusy(false);
        return;
      }
      const app = (
        process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      ).replace(/\/$/, "");
      const snippet =
        `<script src="${app}/track.js"></script>\n` +
        `<script>\n` +
        `  HMTrack.init({ projectId: "${finalSlug}", endpoint: "${app}/api/collect", totalSteps: ${
          total ?? "null"
        }, autoSteps: true });\n` +
        `</script>`;
      setResult({ snippet, projectId: data.projectId });
      setBusy(false);
    } catch (err: any) {
      setError(err?.message || "Erro inesperado");
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div className="max-w-xl mx-auto">
      <Link href="/new" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-ink transition">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Voltar
      </Link>
      <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight mt-1 mb-1">
        Trackear domínio externo
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Seu quiz está hospedado em outro site? Registre a URL e cole o script
        gerado no <code className="text-xs">&lt;head&gt;</code> da página dele. As
        etapas são detectadas automaticamente.
      </p>

      {!result ? (
        <form onSubmit={submit} className="card card-pad space-y-5">
          <div>
            <label className="label">URL da página</label>
            <input
              value={url}
              onChange={(e) => onUrl(e.target.value)}
              placeholder="https://seudominio.com.br/quiz/index.html"
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="auto"
                className="input"
              />
            </div>
            <div>
              <label className="label">Slug (id do tracker)</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto pela URL"
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Nº de etapas — opcional (vazio = automático)</label>
            <input
              value={steps}
              onChange={(e) => setSteps(e.target.value.replace(/\D/g, ""))}
              placeholder="auto"
              inputMode="numeric"
              className="input w-32"
            />
          </div>

          {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3">{error}</p>}

          <button type="submit" disabled={busy} className="btn-brand w-full py-3">
            {busy ? "Gerando…" : "Gerar script de tracking"}
          </button>
        </form>
      ) : (
        <div className="card card-pad space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-emerald-100 text-emerald-600">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <div>
              <div className="font-bold text-ink">Projeto criado!</div>
              <div className="text-sm text-slate-500">
                Agora é só ativar o tracking na sua página.
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink mb-2">
              Copie e cole no{" "}
              <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                &lt;head&gt;
              </code>{" "}
              da sua página:
            </p>
            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed">
                {result.snippet}
              </pre>
            <button
              onClick={copy}
              className="absolute top-2.5 right-2.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg px-2.5 py-1.5 transition"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
            </div>
          </div>

          <div className="rounded-xl bg-brand-50 text-brand-700 text-[13px] p-3.5 leading-relaxed space-y-2">
            <p>
              <b>Pronto.</b> Assim que alguém acessar a página, os eventos já
              aparecem no dashboard. Sem etiquetas, a origem aparece como
              “direto” (mas é trackeada do mesmo jeito).
            </p>
            <p>
              💡 <b>Nos anúncios do Facebook</b>, use o link com etiquetas. O{" "}
              <code className="text-[11px]">utm_source</code> você fixa como{" "}
              <code className="text-[11px]">facebook</code>; os campos{" "}
              <code className="text-[11px]">{`{{...}}`}</code> o{" "}
              <b>próprio Facebook preenche</b> com o nome real da
              campanha/anúncio:
            </p>
            <code className="block text-[11px] bg-white/70 rounded-lg p-2 break-all">
              {`${
                url || "sua-url-do-quiz"
              }?utm_source=facebook&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&cid={{ad.id}}`}
            </code>
          </div>

          <div className="flex items-center gap-3">
            <Link href={`/projects/${result.projectId}`} className="btn-primary flex-1 py-2.5">
              Ver no dashboard
            </Link>
            <button
              onClick={() => {
                setResult(null);
                setUrl("");
                setName("");
                setSlug("");
                setSteps("");
              }}
              className="btn-ghost py-2.5"
            >
              Adicionar outro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
