"use client";

import { useState } from "react";
import { AlertCircle, LoaderCircle, Play } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const liveSampleSchema = z.object({
  id: z.string(),
  expected: z.enum(["safe", "suspicious", "scam"]),
  predicted: z.enum(["safe", "suspicious", "scam", "error"]),
  score: z.number().nullable(),
  latencyMs: z.number(),
  usedFallback: z.boolean(),
});
const liveResponseSchema = z.object({
  datasetSize: z.number(),
  samples: z.array(liveSampleSchema),
});

type LiveResponse = z.infer<typeof liveResponseSchema>;

export function LiveEvalPanel() {
  const [results, setResults] = useState<LiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runLiveEval = async (): Promise<void> => {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch("/api/eval", {
        method: "POST",
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const apiError = z
          .object({ error: z.string() })
          .safeParse(payload);
        throw new Error(
          apiError.success
            ? apiError.data.error
            : "Live evaluation could not be completed.",
        );
      }

      setResults(liveResponseSchema.parse(payload));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Live evaluation could not be completed.",
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Live evaluation
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Run up to five randomly selected examples through the current full
            pipeline. Results may use deterministic fallback if Gemini is
            unavailable.
          </p>
        </div>
        <Button
          disabled={isRunning}
          onClick={() => void runLiveEval()}
          className="shrink-0"
        >
          {isRunning ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
          ) : (
            <Play aria-hidden="true" size={16} />
          )}
          {isRunning ? "Running…" : "Run 5 live samples"}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-status-scam/20 bg-status-scam/5 p-3 text-sm text-foreground"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-status-scam"
            size={17}
          />
          <span>{error}</span>
        </div>
      )}

      {results && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {results.samples.map((sample) => (
            <li
              key={sample.id}
              className="rounded-xl border border-border bg-surface/50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-muted">
                  {sample.id}
                </span>
                <Badge
                  variant={
                    sample.predicted === "error" ? "neutral" : sample.predicted
                  }
                >
                  {sample.predicted}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted">
                Expected {sample.expected}
                {sample.score !== null && ` · score ${sample.score}`}
                {` · ${Math.round(sample.latencyMs)} ms`}
              </p>
              {sample.usedFallback && (
                <p className="mt-2 text-xs font-medium text-status-suspicious">
                  Deterministic fallback used
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
