"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function Header() {
  const router = useRouter();
  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
        <img className="max-w-16" src="https://wd-negocios.com/logo2.png" alt="" />
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/new" className="btn-brand text-sm h-9 px-3.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Adicionar quiz
          </Link>
      
          <button onClick={logout} className="btn-ghost text-sm h-9">
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
