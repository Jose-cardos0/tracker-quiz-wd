"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

export type BarPoint = {
  step: number;
  name: string;
  people: number; // sessões que alcançaram a etapa (contagem absoluta)
};

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

export default function FunnelBars({ data }: { data: BarPoint[] }) {
  if (!data.length) {
    return (
      <div className="h-[260px] grid place-items-center text-sm text-slate-400">
        Sem dados nesse período ainda.
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.people));
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 14, left: -6, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
          <XAxis
            dataKey="step"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="people" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.people === max ? "#4f46e5" : "#c7d2fe"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-5 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="inline-block w-3 h-3 rounded-sm bg-brand-500" /> Pessoas que
          alcançaram cada etapa
        </span>
      </div>
    </div>
  );
}
