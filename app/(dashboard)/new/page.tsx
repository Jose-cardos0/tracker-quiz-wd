"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { unzipSync } from "fflate";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  detectTotalSteps,
  detectName,
  injectTracker,
  normalizeSlug,
  contentTypeFor,
} from "@/lib/quiz-inject";

function reroot(
  raw: Record<string, Uint8Array>
): Record<string, Uint8Array> | null {
  const htmls = Object.keys(raw).filter(
    (p) => /(^|\/)index\.html?$/i.test(p) && !p.endsWith("/")
  );
  if (!htmls.length) return null;
  const indexPath = htmls.sort((a, b) => a.length - b.length)[0];
  const base = indexPath.replace(/index\.html?$/i, "");
  const out: Record<string, Uint8Array> = {};
  for (const [p, data] of Object.entries(raw)) {
    if (p.endsWith("/")) continue;
    if (base && !p.startsWith(base)) continue;
    const rel = base ? p.slice(base.length) : p;
    if (rel) out[rel] = data;
  }
  return out;
}

export default function NewQuizPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState("");
  const [drag, setDrag] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState("quiz");
  const [totalSteps, setTotalSteps] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasPick = !!file || folderFiles.length > 0;
  const folderSize = folderFiles.reduce((s, f) => s + f.size, 0);

  function onSingle(f: File | null) {
    setFile(f);
    setFolderFiles([]);
    setFolderName("");
    setError(null);
    if (f && !name) setName(f.name.replace(/\.(zip|html?)$/i, ""));
  }

  function onFolder(list: FileList | null) {
    const arr = list ? Array.from(list) : [];
    if (!arr.length) return;
    const top = arr[0].webkitRelativePath.split("/")[0] || "";
    setFolderFiles(arr);
    setFile(null);
    setError(null);
    if (top) {
      setFolderName(top);
      if (!name) setName(top);
      if (!slug) setSlug(top);
    }
  }

  async function buildFiles(): Promise<Record<string, Uint8Array> | null> {
    if (folderFiles.length) {
      const raw: Record<string, Uint8Array> = {};
      for (const f of folderFiles) {
        const rp = f.webkitRelativePath || f.name;
        const rel =
          folderName && rp.startsWith(folderName + "/")
            ? rp.slice(folderName.length + 1)
            : rp;
        if (/(^|\/)\.(DS_Store|_)/i.test(rel)) continue;
        raw[rel] = new Uint8Array(await f.arrayBuffer());
      }
      return reroot(raw);
    }
    if (file) {
      if (file.name.toLowerCase().endsWith(".zip")) {
        try {
          return reroot(unzipSync(new Uint8Array(await file.arrayBuffer())));
        } catch {
          return null;
        }
      }
      if (/\.html?$/i.test(file.name)) {
        return { "index.html": new Uint8Array(await file.arrayBuffer()) };
      }
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasPick) {
      setError("Selecione um arquivo, um .zip ou uma pasta");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(null);

    try {
      const files = await buildFiles();
      if (!files) {
        setError("Não consegui ler os arquivos (zip inválido?)");
        setBusy(false);
        return;
      }
      if (!files["index.html"]) {
        setError("Precisa conter um index.html");
        setBusy(false);
        return;
      }

      const finalSlug = normalizeSlug(slug || name || folderName);
      if (!finalSlug) {
        setError("Slug/nome inválido");
        setBusy(false);
        return;
      }

      // injeta o tracker no index.html (no navegador)
      const html0 = new TextDecoder().decode(files["index.html"]);
      const total =
        totalSteps && !isNaN(+totalSteps) ? +totalSteps : detectTotalSteps(html0);
      const finalName = name.trim() || detectName(html0, finalSlug);
      const endpoint = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/collect`
        : "/api/collect";
      const injected = injectTracker(html0, {
        slug: finalSlug,
        endpoint,
        totalSteps: total,
        autoSteps: true,
      });
      files["index.html"] = new TextEncoder().encode(injected);

      const entries = Object.entries(files);

      // 1) pede URLs assinadas (servidor) — payload pequeno, sem os arquivos
      const signRes = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sign",
          slug: finalSlug,
          paths: entries.map(([rel]) => rel),
        }),
      });
      const signData = await signRes.json().catch(() => ({}));
      if (!signRes.ok) {
        setError(signData.error || "Falha ao preparar o upload");
        setBusy(false);
        return;
      }
      const tokenByRel = new Map<string, { path: string; token: string }>(
        (signData.signed || []).map((t: any) => [t.rel, { path: t.path, token: t.token }])
      );

      // 2) envia cada arquivo DIRETO pro Storage (sem limite da Vercel)
      const supabase = createSupabaseBrowserClient();
      setProgress({ done: 0, total: entries.length });
      for (let i = 0; i < entries.length; i++) {
        const [rel, data] = entries[i];
        const t = tokenByRel.get(rel);
        if (!t) {
          setError(`Sem URL para ${rel}`);
          setBusy(false);
          return;
        }
        const ct = contentTypeFor(rel);
        const blob = new Blob([data as BlobPart], { type: ct });
        const { error: upErr } = await supabase.storage
          .from("quizzes")
          .uploadToSignedUrl(t.path, t.token, blob, { contentType: ct });
        if (upErr) {
          setError(`Falha ao enviar ${rel}: ${upErr.message}`);
          setBusy(false);
          return;
        }
        setProgress({ done: i + 1, total: entries.length });
      }

      // 3) registra o projeto
      const regRes = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          slug: finalSlug,
          name: finalName,
          type,
          totalSteps: total,
        }),
      });
      const regData = await regRes.json().catch(() => ({}));
      if (!regRes.ok) {
        setError(regData.error || "Falha ao registrar");
        setBusy(false);
        return;
      }
      router.push(`/projects/${regData.projectId}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Erro inesperado");
      setBusy(false);
    }
  }

  const pctDone = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="max-w-xl">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-ink transition">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Funis
      </Link>
      <h1 className="text-[26px] leading-tight font-black text-ink tracking-tight mt-1 mb-1">
        Adicionar quiz
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Suba um <b>.html</b>, um <b>.zip</b>, ou a <b>pasta inteira</b> (com{" "}
        <code className="text-xs">index.html</code> + <code className="text-xs">assets/</code>).
        O tracker é injetado e as etapas detectadas automaticamente.
      </p>

      <form onSubmit={submit} className="card card-pad space-y-5">
        {/* dropzone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onSingle(e.dataTransfer.files?.[0] || null);
          }}
          className={`rounded-xl p-8 text-center cursor-pointer transition border-2 border-dashed ${
            drag
              ? "border-brand-500 bg-brand-50"
              : hasPick
              ? "border-emerald-300 bg-emerald-50/40"
              : "border-slate-300 hover:border-brand-400 hover:bg-slate-50"
          }`}
        >
          <input ref={fileRef} type="file" accept=".html,.htm,.zip" className="hidden" onChange={(e) => onSingle(e.target.files?.[0] || null)} />
          <input ref={folderRef} type="file" multiple {...({ webkitdirectory: "", directory: "" } as any)} className="hidden" onChange={(e) => onFolder(e.target.files)} />

          {folderFiles.length ? (
            <Picked icon="folder" title={folderName || "Pasta"} sub={`${folderFiles.length} arquivos · ${(folderSize / 1024 / 1024).toFixed(1)} MB`} />
          ) : file ? (
            <Picked icon="check" title={file.name} sub={`${(file.size / 1024).toFixed(0)} KB — clique para trocar`} />
          ) : (
            <div className="text-slate-500">
              <div className="mx-auto grid place-items-center w-10 h-10 rounded-lg bg-slate-100 text-slate-400 mb-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></svg>
              </div>
              <div className="font-semibold text-ink">Arraste um arquivo aqui</div>
              <div className="text-xs mt-1">.html ou .zip</div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => folderRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
          Selecionar uma pasta (o nome da pasta vira o slug)
        </button>

        <div>
          <label className="label">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Quiz Black Friday" className="input" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Slug (URL)</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto pelo nome/pasta" className="input" />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input bg-white">
              <option value="quiz">Quiz (várias etapas)</option>
              <option value="page">Página (venda/brandpage)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Nº de etapas — opcional (vazio = detectar automático)</label>
          <input value={totalSteps} onChange={(e) => setTotalSteps(e.target.value.replace(/\D/g, ""))} placeholder="auto" inputMode="numeric" className="input w-32" />
        </div>

        {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3">{error}</p>}

        {busy && progress && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>Enviando arquivos…</span>
              <span className="tabular-nums font-semibold">
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${pctDone}%` }} />
            </div>
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-brand w-full py-3">
          {busy ? (progress ? `Enviando… ${pctDone}%` : "Preparando…") : "Subir e publicar"}
        </button>

        <p className="text-xs text-slate-400 text-center">
          Os arquivos vão direto pro Storage — sem limite de tamanho. Pastas
          grandes podem demorar um pouco.
        </p>
      </form>

      <p className="text-center text-sm text-slate-500 mt-5">
        Seu quiz está em outro domínio?{" "}
        <Link href="/external" className="font-semibold text-brand-600 hover:underline">
          Trackear domínio externo →
        </Link>
      </p>
    </div>
  );
}

function Picked({
  icon,
  title,
  sub,
}: {
  icon: "folder" | "check";
  title: string;
  sub: string;
}) {
  return (
    <div>
      <div className="mx-auto grid place-items-center w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 mb-2">
        {icon === "folder" ? (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        )}
      </div>
      <div className="font-semibold text-ink break-all">{title}</div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
    </div>
  );
}
