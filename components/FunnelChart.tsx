"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export type ChartPoint = {
  step: number;
  name: string;
  retention: number; // %
  time: number; // seconds (median on step)
};

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

export default function FunnelChart({ data }: { data: ChartPoint[] }) {
  if (!data.length) {
    return (
      <div className="h-[260px] grid place-items-center text-sm text-slate-400">
        Sem dados nesse período ainda.
      </div>
    );
  }
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 10, right: 14, left: -6, bottom: 0 }}>
          <defs>
            <linearGradient id="retFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
          <XAxis
            dataKey="step"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => `${v}s`}
            tick={{ fontSize: 11, fill: "#cbd5e1" }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="retention"
            stroke="#4f46e5"
            strokeWidth={2.5}
            fill="url(#retFill)"
            dot={{ r: 3, fill: "#4f46e5", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="time"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-5 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="inline-block w-3 h-1 rounded bg-brand-600" /> Retenção (%)
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block w-3 h-1 rounded bg-slate-400" /> Tempo mediano por etapa
        </span>
      </div>
    </div>
  );
}
