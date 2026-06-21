"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-bg">
      <form onSubmit={onSubmit} className="w-full max-w-sm card card-pad">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-ink text-white">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 5-6" /></svg>
          </span>
          <div>
            <div className="font-black text-ink leading-tight tracking-tight">
              Funnel<span className="text-brand-600">Tracker</span>
            </div>
            <div className="text-xs text-slate-400">Entre para ver seus funis</div>
          </div>
        </div>

        <label className="label">E-mail</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mb-4"
        />

        <label className="label">Senha</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mb-5"
        />

        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-2.5 mb-4">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
