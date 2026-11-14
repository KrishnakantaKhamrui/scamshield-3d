import { Card } from "@/components/ui/Card";
import type { ConfusionMatrix as ConfusionMatrixData } from "@/lib/eval";
import type { Label } from "@/types";

interface ConfusionMatrixProps {
  matrix: ConfusionMatrixData;
  sampleCount: number;
  heading?: string;
}

const labels: Label[] = ["safe", "suspicious", "scam"];
const labelTitles: Record<Label, string> = {
  safe: "Safe",
  suspicious: "Suspicious",
  scam: "Scam",
};
const labelColors: Record<Label, string> = {
  safe: "var(--status-safe)",
  suspicious: "var(--status-suspicious)",
  scam: "var(--status-scam)",
};

export function ConfusionMatrix({
  matrix,
  sampleCount,
  heading = "Full pipeline confusion matrix",
}: ConfusionMatrixProps) {
  const maxCount = Math.max(
    1,
    ...labels.flatMap((expected) =>
      labels.map((predicted) => matrix[expected][predicted]),
    ),
  );

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {heading}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Rows are expected labels; columns are predicted labels. {sampleCount}{" "}
          items scored.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="mx-auto w-full max-w-lg border-separate border-spacing-1 text-center text-sm">
          <caption className="sr-only">
            Expected labels by predicted labels
          </caption>
          <thead>
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-muted">
                Expected
              </th>
              {labels.map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-2 py-2 text-xs font-semibold text-foreground"
                >
                  {labelTitles[label]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((expected) => (
              <tr key={expected}>
                <th
                  scope="row"
                  className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-foreground"
                >
                  {labelTitles[expected]}
                </th>
                {labels.map((predicted) => {
                  const count = matrix[expected][predicted];
                  const intensity = Math.round((count / maxCount) * 70) + 10;

                  return (
                    <td
                      key={predicted}
                      className="rounded-lg border border-border px-3 py-3 font-semibold text-foreground"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${labelColors[predicted]} ${intensity}%, transparent)`,
                      }}
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
