"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mantém os dados do dashboard atualizados sem recarregar a página:
 * revalida os Server Components em segundo plano (router.refresh) num
 * intervalo e sempre que a aba volta a ficar visível / em foco.
 */
export default function AutoRefresh({ interval = 25000 }: { interval?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(refresh, interval);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router, interval]);

  return null;
}
