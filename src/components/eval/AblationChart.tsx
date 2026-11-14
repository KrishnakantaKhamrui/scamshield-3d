"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  EvalAggregate,
  EvalConfiguration,
} from "@/lib/eval";

interface AblationChartProps {
  aggregates: Record<EvalConfiguration, EvalAggregate>;
}

const configurationLabels: Record<EvalConfiguration, string> = {
  heuristicsOnly: "Rules only",
  llmOnly: "LLM only",
  fullPipeline: "Base full",
  fullThreatIntelRegistry: "Full + TI + Registry",
  rulesThreatIntel: "Rules + TI",
};

export function AblationChart({ aggregates }: AblationChartProps) {
  const data = (Object.keys(configurationLabels) as EvalConfiguration[]).map(
    (key) => {
      const metrics = aggregates[key].metrics;
      return {
        configuration: configurationLabels[key],
        Accuracy: metrics.sampleCount > 0 ? metrics.accuracy : null,
        "Macro F1": metrics.sampleCount > 0 ? metrics.macroF1 : null,
      };
    },
  );

  return (
    <div className="h-72 min-w-0 w-full" role="img" aria-label="Accuracy and macro F1 by evaluation configuration">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 8, left: -16 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="configuration"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => `${(Number(value) * 100).toFixed(1)}%`}
            contentStyle={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              borderRadius: 12,
              color: "var(--foreground)",
            }}
          />
          <Legend />
          <Bar dataKey="Accuracy" fill="var(--accent)" radius={[5, 5, 0, 0]} />
          <Bar dataKey="Macro F1" fill="var(--accent-violet)" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
