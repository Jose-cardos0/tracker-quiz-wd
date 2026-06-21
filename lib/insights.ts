export type Insight = { tone: "good" | "warn" | "bad"; text: string };

type FunnelRow = { step_index: number; sessions_reached: number };
type TimingRow = { step_index: number; median_ms: number };

export function buildInsights(opts: {
  funnel: FunnelRow[];
  timing: TimingRow[];
  sessions: number;
  completed: number;
  stepName: (i: number) => string;
}): Insight[] {
  const { funnel, timing, sessions, completed, stepName } = opts;
  const out: Insight[] = [];
  if (!funnel.length || !sessions) return out;

  const base = funnel[0].sessions_reached || sessions;

  // --- completion rate ----------------------------------------------------
  const rate = sessions ? completed / sessions : 0;
  if (rate >= 0.4)
    out.push({
      tone: "good",
      text: `Boa taxa de conclusão: ${Math.round(
        rate * 100
      )}% das sessões chegam ao fim.`,
    });
  else if (rate >= 0.15)
    out.push({
      tone: "warn",
      text: `Conclusão de ${Math.round(
        rate * 100
      )}% — dá para melhorar reduzindo a fricção nas etapas críticas.`,
    });
  else
    out.push({
      tone: "bad",
      text: `Conclusão baixa: só ${Math.round(
        rate * 100
      )}% terminam. Foque em destravar o começo do funil.`,
    });

  // --- worst drop ---------------------------------------------------------
  let worst = { step: 0, lost: 0, pct: 0 };
  for (let i = 1; i < funnel.length; i++) {
    const prev = funnel[i - 1].sessions_reached;
    const cur = funnel[i].sessions_reached;
    const lost = prev - cur;
    const pct = prev ? lost / prev : 0;
    if (lost > worst.lost) worst = { step: funnel[i].step_index, lost, pct };
  }
  if (worst.lost > 0) {
    const tone = worst.pct >= 0.4 ? "bad" : worst.pct >= 0.2 ? "warn" : "good";
    out.push({
      tone,
      text: `Maior abandono na etapa ${worst.step} (${stepName(
        worst.step
      )}): −${Math.round(worst.pct * 100)}% (${worst.lost} sessões).`,
    });
  }

  // --- bail on the very first step (relevant for paid traffic) ------------
  if (funnel.length >= 2) {
    const firstDrop = base ? (base - funnel[1].sessions_reached) / base : 0;
    if (firstDrop >= 0.35)
      out.push({
        tone: "warn",
        text: `Muita gente sai já na 1ª etapa (−${Math.round(
          firstDrop * 100
        )}%). Costuma ser desalinhamento entre o anúncio e a primeira tela.`,
      });
  }

  // --- slowest step (friction vs engagement) ------------------------------
  if (timing.length) {
    let slow = { step: 0, ms: 0 };
    for (const t of timing) if (t.median_ms > slow.ms) slow = { step: t.step_index, ms: t.median_ms };
    if (slow.ms > 0) {
      const idx = funnel.findIndex((f) => f.step_index === slow.step);
      const dropAfter =
        idx >= 0 && idx < funnel.length - 1
          ? (funnel[idx].sessions_reached - funnel[idx + 1].sessions_reached) /
            (funnel[idx].sessions_reached || 1)
          : 0;
      const secs = Math.round(slow.ms / 1000);
      if (dropAfter >= 0.25)
        out.push({
          tone: "bad",
          text: `Etapa ${slow.step} (${stepName(
            slow.step
          )}) é a mais demorada (~${secs}s) e perde ${Math.round(
            dropAfter * 100
          )}% depois — provável ponto de fricção.`,
        });
      else
        out.push({
          tone: "good",
          text: `Etapa ${slow.step} (${stepName(
            slow.step
          )}) prende mais atenção (~${secs}s) sem perder gente — bom engajamento.`,
        });
    }
  }

  // --- smooth stretch -----------------------------------------------------
  let smooth = 0;
  for (let i = 1; i < funnel.length; i++) {
    const prev = funnel[i - 1].sessions_reached;
    const cur = funnel[i].sessions_reached;
    if (prev && (prev - cur) / prev < 0.05) smooth++;
  }
  if (smooth >= Math.max(2, Math.floor(funnel.length * 0.4)))
    out.push({
      tone: "good",
      text: `${smooth} etapas seguram bem (perda <5%) — o miolo do funil está fluido.`,
    });

  return out;
}
