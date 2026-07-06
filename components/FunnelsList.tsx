"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trash2, Search, ChevronLeft, ChevronRight, Columns2 } from "lucide-react";
import { pct } from "@/lib/format";

type Item = {
  id: string;
  name: string;
  slug: string;
  type: string;
  url: string;
  sessions: number;
  visitors: number;
  completed: number;
};

const PER_PAGE = 10;

export default function FunnelsList() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 25000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => setPage(1), [q]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(s) ||
        i.slug.toLowerCase().includes(s) ||
        i.url.toLowerCase().includes(s)
    );
  }, [items, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);

  async function del(id: string, name: string) {
    if (
      !confirm(
        `Excluir "${name}"? Isso apaga o funil e TODOS os dados de tracking. Não dá pra desfazer.`
      )
    )
      return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
      }
    } finally {
      setDeleting(null);
    }
  }

  if (items === null) return <Skeleton />;

  if (items.length === 0) {
    return (
      <div className="card card-pad text-center py-16">
        <div className="mx-auto grid place-items-center w-12 h-12 rounded-xl bg-brand-50 text-brand-600 mb-4">
          <Search className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-ink">Nenhum funil ainda</h3>
        <p className="text-sm text-slate-500 mt-1 mb-5">
          Use “Adicionar quiz” pra começar a trackear.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar funil por nome…"
          className="input pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 py-10 text-center">
          Nenhum funil encontrado para “{q}”.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {pageItems.map((p) => (
            <Card
              key={p.id}
              p={p}
              deleting={deleting === p.id}
              onDelete={() => del(p.id, p.name)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-7">
          <button
            disabled={curPage <= 1}
            onClick={() => setPage(curPage - 1)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:text-ink"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <span className="text-sm text-slate-500 tabular-nums">
            Página {curPage} de {totalPages}
          </span>
          <button
            disabled={curPage >= totalPages}
            onClick={() => setPage(curPage + 1)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:text-ink"
          >
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <p className="text-center text-xs text-slate-400 mt-3">
        {filtered.length} {filtered.length === 1 ? "funil" : "funis"}
      </p>
    </>
  );
}

function Card({
  p,
  deleting,
  onDelete,
}: {
  p: Item;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="relative group">
      <Link
        href={`/projects/${p.id}`}
        className="block card card-pad transition hover:shadow-cardhover hover:-translate-y-0.5"
      >
        <div className="flex items-start gap-2 pr-9">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-ink truncate">{p.name}</span>
              <span className={p.type === "page" ? "pill-amber" : "pill-slate"}>
                {p.type}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 font-mono truncate">
              {p.url}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
          <Stat label="Sessões" value={p.sessions.toLocaleString("pt-BR")} />
          <Stat label="Visitantes" value={p.visitors.toLocaleString("pt-BR")} />
          <Stat label="Conclusão" value={pct(p.completed, p.sessions)} accent />
        </div>
      </Link>

      <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          href={`/compare?ids=${p.id}`}
          title="Comparar com outros funis"
          className="grid place-items-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 shadow-sm transition hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50"
        >
          <Columns2 className="w-4 h-4" />
        </Link>
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Excluir funil"
          className="grid place-items-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 shadow-sm transition hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-100"
        >
          <Trash2 className={`w-4 h-4 ${deleting ? "animate-pulse" : ""}`} />
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className={`text-[22px] font-black tracking-tight ${
          accent ? "text-brand-600" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="stat-label mt-0.5">{label}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card card-pad animate-pulse">
          <div className="h-4 w-40 bg-slate-100 rounded" />
          <div className="h-3 w-56 bg-slate-100 rounded mt-2" />
          <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-100">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j}>
                <div className="h-6 w-12 bg-slate-100 rounded" />
                <div className="h-2.5 w-14 bg-slate-100 rounded mt-2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
