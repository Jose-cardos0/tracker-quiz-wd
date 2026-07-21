"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import { Users } from "lucide-react";
import type { BarPoint } from "./FunnelBars";

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload as BarPoint;
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-card px-3 py-2 text-xs">
      <div className="font-bold text-ink mb-1">
        {p.step}. {p.name}
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand-500" />
        Pessoas: <b className="text-ink">{p.people}</b>
      </div>
    </div>
  );
}

/**
 * Versão "em pé" (barras horizontais) do gráfico de pessoas por etapa, fixa na
 * margem direita em telas bem largas (>=1700px, onde sobra espaço fora do
 * conteúdo central). Position fixed => acompanha a rolagem. Abaixo desse
 * tamanho fica escondido e o card normal no fluxo (FunnelBars) assume.
 */
export default function FloatingStepBars({ data }: { data: BarPoint[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.people));
  const height = Math.max(320, data.length * 16 + 12);

  return (
    <aside className="hidden min-[1920px]:block fixed top-24 right-6 w-56 z-30">
      <div className="card card-pad">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand-50 text-brand-600">
            <Users className="w-4 h-4" strokeWidth={2.2} />
          </span>
          <h2 className="font-bold text-ink text-sm">Pessoas por etapa</h2>
        </div>
        <p className="text-[11px] text-slate-400 mb-2">
          Volume real em cada ponto do funil.
        </p>
        <div className="max-h-[calc(100vh-11rem)] overflow-y-auto pr-1 -mr-1">
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 2, right: 30, left: 0, bottom: 2 }}
              barCategoryGap={2}
            >
              <XAxis type="number" domain={[0, Math.ceil(max * 1.18)]} hide />
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
                cursor={{ fill: "#f1f5f9" }}
              />
              <Bar dataKey="people" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.people === max ? "#4f46e5" : "#c7d2fe"} />
                ))}
                <LabelList
                  dataKey="people"
                  position="right"
                  offset={4}
                  style={{ fontSize: 9, fill: "#64748b", fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </aside>
  );
}
