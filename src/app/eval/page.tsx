"use client";

import { useEffect, useState } from "react";
import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import { AblationChart } from "@/components/eval/AblationChart";
import { ConfusionMatrix } from "@/components/eval/ConfusionMatrix";
import { LiveEvalPanel } from "@/components/eval/LiveEvalPanel";
import { MetricsTable } from "@/components/eval/MetricsTable";
import { MisclassifiedList } from "@/components/eval/MisclassifiedList";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  EvalPageResultsSchema,
  type EvalAggregate,
  type EvalConfiguration,
  type EvalPublicConfigurationResult,
  type EvalSplit,
} from "@/lib/eval";

type DatasetTab = "india" | "public";

function splitAggregates(
  configurations: ReturnType<typeof EvalPageResultsSchema.parse>["configurations"],
  split: EvalSplit,
): Record<EvalConfiguration, EvalAggregate> {
  return {
    heuristicsOnly: configurations.heuristicsOnly[split],
    llmOnly: configurations.llmOnly[split],
    fullPipeline: configurations.fullPipeline[split],
    fullThreatIntelRegistry: configurations.fullThreatIntelRegistry[split],
    rulesThreatIntel: configurations.rulesThreatIntel[split],
  };
}

function publicAggregates(
  configurations: Record<
    EvalConfiguration,
    EvalPublicConfigurationResult
  >,
): Record<EvalConfiguration, EvalAggregate> {
  return {
    heuristicsOnly: configurations.heuristicsOnly.overall,
    llmOnly: configurations.llmOnly.overall,
    fullPipeline: configurations.fullPipeline.overall,
    fullThreatIntelRegistry:
      configurations.fullThreatIntelRegistry.overall,
    rulesThreatIntel: configurations.rulesThreatIntel.overall,
  };
}

function EvaluationNotes() {
  return (
    <p className="rounded-xl border border-border bg-surface/40 px-4 py-3 text-sm leading-6 text-muted">
      Small sets, English-only public data, and results are indicative—not
      production claims.
    </p>
  );
}

export default function EvalPage() {
  const [results, setResults] = useState<
    ReturnType<typeof EvalPageResultsSchema.parse> | null
  >(null);
  const [split, setSplit] = useState<EvalSplit>("tune");
  const [datasetTab, setDatasetTab] = useState<DatasetTab>("india");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadResults(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/eval", { cache: "no-store" });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const parsedError = typeof payload === "object" && payload !== null
            ? "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Evaluation results could not be loaded."
            : "Evaluation results could not be loaded.";
          throw new Error(parsedError);
        }

        const parsedResults = EvalPageResultsSchema.parse(payload);
        if (active) {
          setResults(parsedResults);
        }
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Evaluation results could not be loaded.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadResults();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (isLoading) {
    return (
      <div
        className="flex min-h-80 w-full items-center justify-center"
        role="status"
      >
        <LoaderCircle
          aria-hidden="true"
          className="animate-spin text-accent"
          size={26}
        />
        <span className="sr-only">Loading evaluation results</span>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="w-full">
        <Card className="mx-auto max-w-xl p-5" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-status-scam"
              size={20}
            />
            <div>
              <h1 className="font-display text-lg font-semibold text-foreground">
                Evaluation results unavailable
              </h1>
              <p className="mt-1 text-sm leading-6 text-muted">
                {error ?? "Run npm run eval to generate the results file."}
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                <RefreshCw aria-hidden="true" size={16} />
                Retry
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const fullPipeline = results.configurations.fullThreatIntelRegistry;
  const splitItems = fullPipeline.items.filter((item) => item.split === split);
  const confusion = fullPipeline.overall.metrics.confusionMatrix;
  const aggregates = splitAggregates(results.configurations, split);
  const publicDataset = results.publicDataset;
  const publicMetrics = publicDataset
    ? publicAggregates(publicDataset.configurations)
    : null;

  return (
    <div className="w-full space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Evaluation methodology
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Pipeline evaluation
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Compare rules, Gemini, threat intelligence, and registry evidence
              on separate labeled datasets.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface/70 px-4 py-3 text-sm text-foreground">
            <p>
              <span className="font-semibold">
                {datasetTab === "india"
                  ? results.datasetSize
                  : publicDataset?.datasetSize ?? "Not prepared"}
              </span>{" "}
              {datasetTab === "india"
                ? "India evaluation items"
                : "public SMS items"}
            </p>
            <p className="mt-1 text-xs text-muted">
              Generated{" "}
              {new Date(
                datasetTab === "india"
                  ? results.generatedAt
                  : publicDataset?.generatedAt ?? results.generatedAt,
              ).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted">
              Model: {results.model}
            </p>
          </div>
        </div>
      </header>

      <div
        aria-label="Choose evaluation dataset"
        className="inline-flex flex-wrap rounded-xl border border-border bg-surface/70 p-1"
        role="tablist"
      >
        {(
          [
            ["india", "India scam set"],
            ["public", "Public dataset"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            id={`eval-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={datasetTab === value}
            aria-controls={`eval-panel-${value}`}
            onClick={() => setDatasetTab(value)}
            className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              datasetTab === value
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {datasetTab === "india" ? (
        <section
          id="eval-panel-india"
          aria-labelledby="eval-tab-india"
          role="tabpanel"
          className="space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Tune and holdout split
              </h2>
              <p className="mt-1 text-xs text-muted">
                The full + threat intel + registry confusion matrix uses all
                successfully scored items.
              </p>
            </div>
            <div
              aria-label="Choose evaluation split"
              className="inline-flex rounded-xl border border-border bg-surface/70 p-1"
              role="group"
            >
              {(["tune", "holdout"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={split === value}
                  onClick={() => setSplit(value)}
                  className={`min-h-10 rounded-lg px-4 text-sm font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    split === value
                      ? "bg-accent text-white"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <MetricsTable aggregates={aggregates} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="min-w-0 p-4 sm:p-5">
              <div className="mb-2">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Ablation comparison
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Accuracy and macro-F1 for the selected split.
                </p>
              </div>
              <AblationChart aggregates={aggregates} />
            </Card>
            <ConfusionMatrix
              heading="Full + threat intel + registry confusion matrix"
              matrix={confusion}
              sampleCount={fullPipeline.overall.metrics.sampleCount}
            />
          </div>

          <MisclassifiedList items={splitItems} />
          <LiveEvalPanel />
          <EvaluationNotes />
        </section>
      ) : (
        <section
          id="eval-panel-public"
          aria-labelledby="eval-tab-public"
          role="tabpanel"
          className="space-y-6"
        >
          {!publicDataset || !publicMetrics ? (
            <Card className="p-5">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Public dataset results are not available
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Place the UCI SMS Spam Collection CSV at{" "}
                <code>data/public/sms_spam.csv</code>, then run{" "}
                <code>npm run prepare:public-eval</code> and{" "}
                <code>npm run eval</code>.
              </p>
              <p className="mt-2 text-sm text-muted">
                English, non-India, tests generalization.
              </p>
            </Card>
          ) : (
            <>
              <Card className="p-4 sm:p-5">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {publicDataset.label}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {publicDataset.source} · fixed seed {publicDataset.seed} ·{" "}
                  {publicDataset.datasetSize} balanced samples
                </p>
                <p className="mt-1 text-xs text-muted">
                  Public results generated{" "}
                  {new Date(publicDataset.generatedAt).toLocaleString()}
                </p>
              </Card>
              <MetricsTable aggregates={publicMetrics} />
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="min-w-0 p-4 sm:p-5">
                  <div className="mb-2">
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      Public dataset ablation
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Accuracy and macro-F1 on the full public slice.
                    </p>
                  </div>
                  <AblationChart aggregates={publicMetrics} />
                </Card>
                <ConfusionMatrix
                  heading="Public full + threat intel + registry confusion matrix"
                  matrix={
                    publicDataset.configurations.fullThreatIntelRegistry
                      .overall.metrics.confusionMatrix
                  }
                  sampleCount={
                    publicDataset.configurations.fullThreatIntelRegistry
                      .overall.metrics.sampleCount
                  }
                />
              </div>
              <MisclassifiedList
                items={
                  publicDataset.configurations.fullThreatIntelRegistry.items
                }
                maxItems={10}
              />
            </>
          )}
          <EvaluationNotes />
        </section>
      )}
    </div>
  );
}
