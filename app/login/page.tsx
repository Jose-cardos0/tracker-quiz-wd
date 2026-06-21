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
        <div className="flex justify-center items-center gap-2.5 mb-6 mx-auto">
          <img className="max-w-32" src="https://wd-negocios.com/logo2.png" alt="" />
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
        <div className="text-xs text-gray-300 flex itens-cemter justify-center max-auto mt-4">
          <p>Desenvolvido por <a href="https://codenxt.online">CODENXT</a></p>
        </div>
      </form>
    </main>
  );
}
