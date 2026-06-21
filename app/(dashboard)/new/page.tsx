"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasPick) {
      setError("Selecione um arquivo, um .zip ou uma pasta");
      return;
    }
    setBusy(true);
    setError(null);

    const fd = new FormData();
    fd.append("name", name);
    fd.append("slug", slug);
    fd.append("type", type);
    if (totalSteps) fd.append("totalSteps", totalSteps);

    if (folderFiles.length) {
      const paths: string[] = [];
      for (const f of folderFiles) {
        const rp = f.webkitRelativePath || f.name;
        const rel =
          folderName && rp.startsWith(folderName + "/")
            ? rp.slice(folderName.length + 1)
            : rp;
        // skip junk
        if (/(^|\/)\.(DS_Store|_)/i.test(rel)) continue;
        paths.push(rel);
        fd.append("files", f);
      }
      fd.append("paths", JSON.stringify(paths));
    } else if (file) {
      fd.append("file", file);
    }

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha no upload");
        setBusy(false);
        return;
      }
      router.push(`/projects/${data.projectId}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Erro de rede");
      setBusy(false);
    }
  }

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
        {/* dropzone (arquivo único / zip) */}
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
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,.zip"
            className="hidden"
            onChange={(e) => onSingle(e.target.files?.[0] || null)}
          />
          <input
            ref={folderRef}
            type="file"
            multiple
            {...({ webkitdirectory: "", directory: "" } as any)}
            className="hidden"
            onChange={(e) => onFolder(e.target.files)}
          />

          {folderFiles.length ? (
            <Picked
              icon="folder"
              title={folderName || "Pasta"}
              sub={`${folderFiles.length} arquivos · ${(folderSize / 1024).toFixed(0)} KB`}
            />
          ) : file ? (
            <Picked
              icon="check"
              title={file.name}
              sub={`${(file.size / 1024).toFixed(0)} KB — clique para trocar`}
            />
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

        {/* selecionar pasta */}
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
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Quiz Black Friday"
            className="input"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Slug (URL)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto pelo nome/pasta"
              className="input"
            />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input bg-white"
            >
              <option value="quiz">Quiz (várias etapas)</option>
              <option value="page">Página (venda/brandpage)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Nº de etapas — opcional (vazio = detectar automático)</label>
          <input
            value={totalSteps}
            onChange={(e) => setTotalSteps(e.target.value.replace(/\D/g, ""))}
            placeholder="auto"
            inputMode="numeric"
            className="input w-32"
          />
        </div>

        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3">{error}</p>
        )}

        <button type="submit" disabled={busy} className="btn-brand w-full py-3">
          {busy ? "Enviando…" : "Subir e publicar"}
        </button>

        <p className="text-xs text-slate-400 text-center">
          Limite ~4 MB por envio (limite da Vercel). Para mídias pesadas, mantenha
          imagens leves ou em URL externa.
        </p>
      </form>
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
