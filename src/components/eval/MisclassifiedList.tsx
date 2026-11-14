import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { EvalSampleResult } from "@/lib/eval";

interface MisclassifiedListProps {
  items: Array<
    Pick<EvalSampleResult, "id" | "expected" | "predicted" | "error">
  >;
  maxItems?: number;
}

export function MisclassifiedList({
  items,
  maxItems,
}: MisclassifiedListProps) {
  const misclassified = items.filter(
    ({ expected, predicted }) => predicted === "error" || predicted !== expected,
  );
  const visibleItems =
    maxItems === undefined
      ? misclassified
      : misclassified.slice(0, maxItems);

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Misclassified items
          </h2>
          <p className="mt-1 text-sm text-muted">
            Errors are shown separately and are excluded from metrics.
          </p>
        </div>
        <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
          {misclassified.length} items
        </span>
      </div>

      {misclassified.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-status-safe/20 bg-status-safe/5 p-4 text-sm text-foreground">
          <CheckCircle2
            aria-hidden="true"
            className="shrink-0 text-status-safe"
            size={18}
          />
          No misclassifications in this split.
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleItems.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface/50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-status-suspicious"
                  size={17}
                />
                <div>
                  <p className="font-mono text-xs font-semibold text-muted">
                    {item.id}
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Expected <strong>{item.expected}</strong>, predicted{" "}
                    <strong>{item.predicted}</strong>
                  </p>
                  {item.error && (
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {item.error}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
                <Badge variant={item.expected}>{item.expected}</Badge>
                <span aria-hidden="true" className="text-muted">
                  →
                </span>
                <Badge
                  variant={item.predicted === "error" ? "neutral" : item.predicted}
                >
                  {item.predicted}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
      {visibleItems.length < misclassified.length && (
        <p className="mt-3 text-xs text-muted">
          Showing {visibleItems.length} of {misclassified.length} items.
        </p>
      )}
    </Card>
  );
}
