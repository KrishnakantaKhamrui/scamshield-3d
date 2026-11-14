import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DefangedText } from "@/components/ui/DefangedText";
import { RiskGauge } from "@/components/analyze/RiskGauge";
import type { Verdict } from "@/types";

type ExplanationLanguage = keyof Verdict["explanation"];

interface VerdictCardProps {
  verdict: Verdict;
  language: ExplanationLanguage;
}

export function VerdictCard({ verdict, language }: VerdictCardProps) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant={verdict.label}>
          {verdict.label.charAt(0).toUpperCase() + verdict.label.slice(1)}
        </Badge>
        <p className="text-sm text-muted">
          Confidence{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {Math.round(verdict.confidence * 100)}%
          </span>
        </p>
      </div>

      <div className="my-4">
        <RiskGauge label={verdict.label} score={verdict.score} />
      </div>

      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
          Detected scam type
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
          <DefangedText text={verdict.scamType} />
        </h2>
      </div>

      <p
        className="mt-5 rounded-xl border border-border bg-background/60 p-4 text-sm leading-6 text-foreground"
        dir="auto"
      >
        <DefangedText text={verdict.explanation[language]} />
      </p>

      {verdict.reasons.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-foreground">Why this result?</h3>
          <ul className="mt-2 space-y-2">
            {verdict.reasons.map((reason, index) => (
              <li
                key={`${reason}-${index}`}
                className="flex gap-2 text-sm leading-5 text-muted"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
                />
                <DefangedText text={reason} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {verdict.meta.usedFallback && (
        <p className="mt-5 rounded-lg border border-border bg-surface/70 px-3 py-2 text-xs leading-5 text-muted">
          This result used deterministic fallback checks because AI reasoning
          was unavailable.
        </p>
      )}
    </Card>
  );
}
