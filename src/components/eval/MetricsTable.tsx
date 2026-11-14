import { Card } from "@/components/ui/Card";
import type {
  EvalAggregate,
  EvalConfiguration,
} from "@/lib/eval";

interface MetricsTableProps {
  aggregates: Record<EvalConfiguration, EvalAggregate>;
}

const configurationLabels: Record<EvalConfiguration, string> = {
  heuristicsOnly: "Rules only",
  llmOnly: "LLM only",
  fullPipeline: "Base full (without TI/Registry)",
  fullThreatIntelRegistry: "Full + threat intel + registry",
  rulesThreatIntel: "Rules + threat intel (no LLM)",
};

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function milliseconds(value: number): string {
  return `${Math.round(value)} ms`;
}

export function MetricsTable({ aggregates }: MetricsTableProps) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Configuration metrics
        </h2>
        <p className="mt-1 text-sm text-muted">
          Scam detection flags both suspicious and scam messages as positive.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-3 font-semibold">Configuration</th>
              <th className="px-3 py-3 font-semibold">Accuracy</th>
              <th className="px-3 py-3 font-semibold">Scam precision</th>
              <th className="px-3 py-3 font-semibold">Scam recall</th>
              <th className="px-3 py-3 font-semibold">Scam F1</th>
              <th className="px-3 py-3 font-semibold">Safe false-positive rate</th>
              <th className="px-3 py-3 font-semibold">Avg latency</th>
              <th className="px-3 py-3 font-semibold">P95 latency</th>
              <th className="px-3 py-3 font-semibold">Errors</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(configurationLabels) as EvalConfiguration[]).map(
              (key) => {
                const aggregate = aggregates[key];
                const metrics = aggregate.metrics;
                const hasPredictions = metrics.sampleCount > 0;
                const showMetric = (value: number) =>
                  hasPredictions ? percentage(value) : "—";

                return (
                  <tr key={key} className="border-b border-border/70 last:border-0">
                    <th className="px-3 py-3 font-medium text-foreground">
                      {configurationLabels[key]}
                    </th>
                    <td className="px-3 py-3 text-foreground">
                      {showMetric(metrics.accuracy)}
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {showMetric(metrics.scamDetection.precision)}
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {showMetric(metrics.scamDetection.recall)}
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {showMetric(metrics.scamDetection.f1)}
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {showMetric(metrics.scamDetection.falsePositiveRate)}
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {milliseconds(aggregate.averageLatencyMs)}
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {milliseconds(aggregate.p95LatencyMs)}
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      <span>
                        {aggregate.errorCount} errors / {aggregate.sampleCount} scored
                      </span>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
