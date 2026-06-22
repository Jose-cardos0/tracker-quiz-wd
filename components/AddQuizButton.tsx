"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Upload, Globe, X, ChevronRight } from "lucide-react";

export default function AddQuizButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function pick(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-brand text-sm h-9 px-3.5">
        <Plus className="w-4 h-4" strokeWidth={2.4} />
        Adicionar quiz
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[100] grid place-items-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="relative z-10 w-full max-w-md card p-6">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-ink transition"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-black text-ink">Adicionar quiz</h2>
            <p className="text-sm text-slate-500 mb-5">
              Como você quer trackear esse quiz?
            </p>

            <div className="grid gap-3">
              <Choice
                icon={<Upload className="w-5 h-5" strokeWidth={2.2} />}
                grad="from-indigo-500 to-violet-500"
                title="Subir arquivo"
                desc="Hospede aqui (.html, .zip ou pasta inteira). O tracker é injetado automaticamente."
                onClick={() => pick("/new")}
              />
              <Choice
                icon={<Globe className="w-5 h-5" strokeWidth={2.2} />}
                grad="from-sky-500 to-cyan-500"
                title="Link externo"
                desc="Seu quiz está em outro domínio. Geramos o script pra você colar no <head>."
                onClick={() => pick("/external")}
              />
            </div>
          </div>
          </div>,
          document.body
        )}
    </>
  );
}

function Choice({
  icon,
  grad,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  grad: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 text-left rounded-2xl border border-slate-200 p-4 hover:border-brand-400 hover:bg-slate-50 transition"
    >
      <span
        className={`grid place-items-center w-11 h-11 rounded-xl text-white bg-gradient-to-br ${grad} shadow-sm shrink-0`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-ink">{title}</span>
        <span className="block text-[13px] text-slate-500 leading-snug">{desc}</span>
      </span>
      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500 transition shrink-0" />
    </button>
  );
}
