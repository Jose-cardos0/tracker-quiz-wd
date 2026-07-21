"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { LineChart } from "lucide-react";
import type { ChartPoint } from "./FunnelChart";

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload as ChartPoint;
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-card px-3 py-2 text-xs">
      <div className="font-bold text-ink mb-1">
        {p.step}. {p.name}
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-600" />
        Retenção: <b className="text-ink">{p.retention}%</b>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400" />
        Tempo (mediana): <b className="text-ink">{p.time}s</b>
      </div>
    </div>
  );
}

/**
 * Versão "em pé" da "Relação entre as etapas" (retenção × tempo), fixa na
 * margem ESQUERDA em telas bem largas (>=1750px). Etapa 1 no topo -> N embaixo,
 * mesma ordem do painel de volume à direita, pra comparar na mesma altura.
 * Position fixed => acompanha a rolagem.
 */
export default function FloatingRetentionChart({
  data,
}: {
  data: ChartPoint[];
}) {
  if (!data.length) return null;
  const height = Math.max(320, data.length * 16 + 12);

  return (
    <aside className="hidden min-[1750px]:block fixed top-24 left-[5.5rem] w-56 z-30">
      <div className="card card-pad">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand-50 text-brand-600">
            <LineChart className="w-4 h-4" strokeWidth={2.2} />
          </span>
          <h2 className="font-bold text-ink text-sm">Relação entre etapas</h2>
        </div>
        <p className="text-[11px] text-slate-400 mb-2">
          Retenção × tempo em cada etapa.
        </p>
        <div className="max-h-[calc(100vh-11rem)] overflow-y-auto pr-1 -mr-1">
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart
              layout="vertical"
              data={data}
              margin={{ top: 2, right: 8, left: 0, bottom: 2 }}
            >
              <XAxis xAxisId="pct" type="number" domain={[0, 100]} hide />
              <XAxis xAxisId="time" type="number" orientation="top" hide />
              <YAxis
                type="category"
                dataKey="step"
                width={22}
                interval={0}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
              />
              <Line
                xAxisId="time"
                type="monotone"
                dataKey="time"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                xAxisId="pct"
                type="monotone"
                dataKey="retention"
                stroke="#4f46e5"
                strokeWidth={2.2}
                dot={{ r: 2, fill: "#4f46e5", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-3 mt-1 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <i className="inline-block w-2.5 h-1 rounded bg-brand-600" /> Retenção
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block w-2.5 h-1 rounded bg-slate-400" /> Tempo
          </span>
        </div>
      </div>
    </aside>
  );
}
