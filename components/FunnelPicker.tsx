"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, Check } from "lucide-react";

/**
 * Seletor de funis do dashboard: um botão com lupa que abre um popup com busca
 * + checkboxes. A seleção é um RASCUNHO enquanto o popup está aberto; só aplica
 * (e filtra) ao clicar em "Salvar".
 */
export default function FunnelPicker({
  funnels,
  value,
  onChange,
}: {
  funnels: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const [q, setQ] = useState("");

  // abre com o estado atual
  useEffect(() => {
    if (open) {
      setDraft(value);
      setQ("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const allIds = funnels.map((f) => f.id);
  const draftSet = useMemo(() => new Set(draft), [draft]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return funnels;
    return funnels.filter((f) => f.name.toLowerCase().includes(s));
  }, [funnels, q]);

  function toggle(id: string) {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function save() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <>
      {/* trigger */}
      <button
        onClick={() => setOpen(true)}
        className="w-full card card-pad flex items-center justify-between gap-3 text-left transition hover:shadow-cardhover"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-brand-50 text-brand-600 shrink-0">
            <Search className="w-4 h-4" strokeWidth={2.4} />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-ink text-sm">
              Funis no cruzamento
            </span>
            <span className="block text-xs text-slate-400">
              {value.length} de {funnels.length} selecionados
            </span>
          </span>
        </span>
        <span className="text-sm font-semibold text-brand-600 shrink-0">
          Escolher
        </span>
      </button>

      {/* popup */}
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg card relative flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="p-5 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-ink text-lg">Selecionar funis</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-ink transition"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar funil por nome…"
                  className="input pl-9"
                />
              </div>
              <div className="flex items-center justify-between mt-3 text-sm">
                <span className="text-slate-400 font-semibold">
                  {draft.length} selecionado{draft.length === 1 ? "" : "s"}
                </span>
                <div className="flex items-center gap-3 font-semibold">
                  <button
                    onClick={() => setDraft(allIds)}
                    className="text-brand-600 hover:underline"
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setDraft([])}
                    className="text-slate-400 hover:text-ink"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            {/* lista */}
            <div className="flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-slate-400 py-10 text-center">
                  Nenhum funil encontrado.
                </p>
              ) : (
                filtered.map((f) => {
                  const on = draftSet.has(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggle(f.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-slate-50 transition"
                    >
                      <span
                        className={`grid place-items-center w-5 h-5 rounded-md border-2 shrink-0 transition ${
                          on
                            ? "bg-brand-600 border-brand-600 text-white"
                            : "border-slate-300"
                        }`}
                      >
                        {on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                      </span>
                      <span
                        className={`text-sm truncate ${
                          on ? "text-ink font-semibold" : "text-slate-600"
                        }`}
                      >
                        {f.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* footer */}
            <div className="p-4 border-t border-slate-100 flex items-center gap-3">
              <button
                onClick={() => setOpen(false)}
                className="btn-ghost py-2.5"
              >
                Cancelar
              </button>
              <button onClick={save} className="btn-primary flex-1 py-2.5">
                Salvar e filtrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
