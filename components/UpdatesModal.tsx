"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles } from "lucide-react";

/**
 * Popup de novidades exibido após o login. O "não ver novamente" é salvo no
 * localStorage com a VERSÃO atual — quando você lançar novidades, basta trocar
 * o VERSION e a lista UPDATES que o popup volta a aparecer pra todos.
 */
const VERSION = "2026-07-06";
const STORAGE_KEY = "hm_updates_dismissed";

const UPDATES: { emoji: string; title: string; desc: string }[] = [
  {
    emoji: "🔀",
    title: "Comparar funis lado a lado",
    desc: "Escolha 2+ funis e veja veredito (quem mais converte / prende / abandona) e gráficos de retenção, conclusão e sessões.",
  },
  {
    emoji: "🔎",
    title: "Sessões com filtros e gráficos",
    desc: "Filtre por país, origem e status; resumo em pizza e linha por dia acima da tabela.",
  },
  {
    emoji: "🌍",
    title: "Trackear quiz em outro domínio",
    desc: "Gere um script pra colar no <head> de qualquer página externa e trackear do mesmo jeito.",
  },
  {
    emoji: "🏳️",
    title: "Bandeiras dos países",
    desc: "As sessões agora mostram a bandeira real do país (funciona até no Windows).",
  },
  {
    emoji: "⚡",
    title: "Home com busca, paginação e loading",
    desc: "Busque funis por nome, 10 por página, e um loading ao abrir cada funil.",
  },
];

export default function UpdatesModal() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) !== VERSION) setOpen(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dontShow]);

  function close() {
    if (dontShow) {
      try {
        localStorage.setItem(STORAGE_KEY, VERSION);
      } catch {}
    }
    setOpen(false);
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={close} />
      <div className="relative z-10 w-full max-w-lg card overflow-hidden">
        {/* header */}
        <div className="relative bg-gradient-to-br from-brand-600 to-violet-600 text-white p-6">
          <button onClick={close} className="absolute top-4 right-4 text-white/80 hover:text-white" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/15">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="text-lg font-black leading-tight">Novidades</div>
              <div className="text-white/80 text-sm">O que há de novo no painel</div>
            </div>
          </div>
        </div>

        {/* lista */}
        <div className="p-6 max-h-[55vh] overflow-y-auto space-y-4">
          {UPDATES.map((u, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xl leading-none mt-0.5">{u.emoji}</span>
              <div>
                <div className="font-bold text-ink">{u.title}</div>
                <div className="text-[13.5px] text-slate-500 leading-relaxed">{u.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-brand-600"
            />
            Não ver novamente
          </label>
          <button onClick={close} className="btn-brand px-5">
            Entendi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
