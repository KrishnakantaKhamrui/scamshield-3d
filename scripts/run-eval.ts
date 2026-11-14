import * as dotenv from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { runPipeline } from "../src/lib/agent/orchestrator";
import {
  EvalPublicDatasetSchema,
  computeMetrics,
  PUBLIC_EVAL_LABEL,
  type EvalAggregate,
  type EvalConfiguration,
  type EvalConfigurationResult,
  type EvalPublicConfigurationResult,
  type EvalPublicDatasetDocument,
  type EvalPublicItem,
  type EvalPublicResultsDocument,
  type EvalResultsDocument,
  type EvalSampleResult,
} from "../src/lib/eval";
import type { EvalItem, Label, PipelineOptions } from "../src/types";

const datasetItemSchema = z
  .object({
    id: z.string().min(1),
    label: z.enum(["safe", "suspicious", "scam"]),
    category: z.string().min(1),
    split: z.enum(["tune", "holdout"]),
    text: z.string().min(1),
    adversarial: z.boolean().optional(),
  })
  .strict();

const datasetSchema = z.array(datasetItemSchema).min(1);

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
if (!process.env.GEMINI_API_KEY?.trim()) {
  dotenv.config({ path: path.resolve(process.cwd(), "..", ".env.local") });
}

interface ConfigurationPlan {
  key: EvalConfiguration;
  options: PipelineOptions;
  requiresGemini: boolean;
}

const configurationPlans: ConfigurationPlan[] = [
  {
    key: "heuristicsOnly",
    options: {
      toolsOnly: true,
      threatIntelEnabled: false,
      registryEnabled: false,
    },
    requiresGemini: false,
  },
  {
    key: "llmOnly",
    options: {
      llmOnly: true,
      threatIntelEnabled: false,
      registryEnabled: false,
    },
    requiresGemini: true,
  },
  {
    key: "fullPipeline",
    options: { threatIntelEnabled: false, registryEnabled: false },
    requiresGemini: true,
  },
  {
    key: "fullThreatIntelRegistry",
    options: { threatIntelEnabled: true, registryEnabled: true },
    requiresGemini: true,
  },
  {
    key: "rulesThreatIntel",
    options: {
      toolsOnly: true,
      threatIntelEnabled: true,
      registryEnabled: false,
    },
    requiresGemini: false,
  },
];

async function mapConcurrent<T, U>(
  items: T[],
  concurrency: number,
  mapItem: (item: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapItem(items[index]);
      }
    }),
  );

  return results;
}

function errorResult(
  item: EvalItem,
  latencyMs: number,
  message: string,
): EvalSampleResult {
  return {
    id: item.id,
    expected: item.label,
    predicted: "error",
    score: null,
    latencyMs,
    split: item.split,
    error: message,
  };
}

async function evaluateItem(
  item: EvalItem,
  options: PipelineOptions,
  requiresGemini: boolean,
): Promise<EvalSampleResult> {
  const start = Date.now();
  try {
    const verdict = await runPipeline(item.text, options);
    const latencyMs = Date.now() - start;
    if (requiresGemini && verdict.meta.usedFallback) {
      return errorResult(
        item,
        latencyMs,
        "Gemini failed or returned an invalid verdict; fallback excluded.",
      );
    }

    return {
      id: item.id,
      expected: item.label,
      predicted: verdict.label,
      score: verdict.score,
      latencyMs,
      split: item.split,
    };
  } catch {
    return errorResult(
      item,
      Date.now() - start,
      "Pipeline could not produce a valid verdict.",
    );
  }
}

function percentile95(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function createAggregate(items: EvalSampleResult[]): EvalAggregate {
  const successful = items.filter(
    (item): item is EvalSampleResult & { predicted: Label } =>
      item.predicted !== "error",
  );
  const latencies = items.map((item) => item.latencyMs);

  return {
    sampleCount: successful.length,
    errorCount: items.length - successful.length,
    metrics: computeMetrics(
      successful.map(({ expected, predicted }) => ({ expected, predicted })),
    ),
    averageLatencyMs:
      latencies.length === 0
        ? 0
        : latencies.reduce((total, latency) => total + latency, 0) /
          latencies.length,
    p95LatencyMs: percentile95(latencies),
  };
}

async function evaluateConfiguration(
  items: EvalItem[],
  plan: ConfigurationPlan,
): Promise<EvalConfigurationResult> {
  const results = await mapConcurrent(items, 2, (item) =>
    evaluateItem(item, plan.options, plan.requiresGemini),
  );

  return {
    overall: createAggregate(results),
    tune: createAggregate(results.filter((item) => item.split === "tune")),
    holdout: createAggregate(results.filter((item) => item.split === "holdout")),
    items: results,
  };
}

async function evaluatePublicConfiguration(
  items: EvalPublicItem[],
  plan: ConfigurationPlan,
): Promise<EvalPublicConfigurationResult> {
  const results = await mapConcurrent(items, 2, (item) =>
    evaluateItem(
      { ...item, split: "holdout" },
      plan.options,
      plan.requiresGemini,
    ),
  );

  return {
    overall: createAggregate(results),
    items: results.map(
      ({ id, expected, predicted, score, latencyMs, error }) => ({
        id,
        expected,
        predicted,
        score,
        latencyMs,
        ...(error ? { error } : {}),
      }),
    ),
  };
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function loadPublicDataset(
  filePath: string,
): Promise<EvalPublicDatasetDocument | null> {
  let contents: string;
  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw new Error("Public evaluation input could not be read.");
  }

  try {
    const dataset = EvalPublicDatasetSchema.parse(JSON.parse(contents));
    const safeCount = dataset.items.filter(
      (item) => item.label === "safe",
    ).length;
    const scamCount = dataset.items.filter(
      (item) => item.label === "scam",
    ).length;
    if (safeCount !== 40 || scamCount !== 40) {
      throw new Error("Invalid public class balance.");
    }
    return dataset;
  } catch {
    throw new Error(
      "Public evaluation input is invalid. Run npm run prepare:public-eval.",
    );
  }
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function printSummary(document: EvalResultsDocument): void {
  const rows = configurationPlans.flatMap(({ key }) => {
    const config = document.configurations[key];
    return (["overall", "tune", "holdout"] as const).map((split) => {
      const aggregate = config[split];
      return [
        key,
        split,
        percentage(aggregate.metrics.accuracy),
        percentage(aggregate.metrics.scamDetection.precision),
        percentage(aggregate.metrics.scamDetection.recall),
        percentage(aggregate.metrics.scamDetection.f1),
        percentage(aggregate.metrics.scamDetection.falsePositiveRate),
        `${aggregate.averageLatencyMs.toFixed(0)}ms`,
        `${aggregate.p95LatencyMs.toFixed(0)}ms`,
        aggregate.errorCount,
      ].join("\t");
    });
  });

  console.log(
    [
      "Configuration\tSplit\tAccuracy\tScam P\tScam R\tScam F1\tSafe FPR\tAvg latency\tP95 latency\tErrors",
      ...rows,
    ].join("\n"),
  );
}

function printPublicSummary(document: EvalPublicResultsDocument): void {
  const rows = configurationPlans.map(({ key }) => {
    const aggregate = document.configurations[key].overall;
    return [
      key,
      percentage(aggregate.metrics.accuracy),
      percentage(aggregate.metrics.scamDetection.precision),
      percentage(aggregate.metrics.scamDetection.recall),
      percentage(aggregate.metrics.scamDetection.f1),
      aggregate.errorCount,
    ].join("\t");
  });
  console.log(
    [
      `Public dataset (${PUBLIC_EVAL_LABEL}): ${document.datasetSize} items`,
      "Configuration\tAccuracy\tScam P\tScam R\tScam F1\tErrors",
      ...rows,
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const dataDirectory = path.resolve(process.cwd(), "data");
  const dataset: EvalItem[] = datasetSchema.parse(
    JSON.parse(
      await readFile(path.join(dataDirectory, "eval-set.json"), "utf8"),
    ),
  );

  const configurations = {} as Record<
    EvalConfiguration,
    EvalConfigurationResult
  >;
  for (const plan of configurationPlans) {
    console.log(`Running ${plan.key} on ${dataset.length} items...`);
    configurations[plan.key] = await evaluateConfiguration(dataset, plan);
  }

  const document: EvalResultsDocument = {
    datasetSize: dataset.length,
    generatedAt: new Date().toISOString(),
    model: process.env.GEMINI_MODEL?.trim() || "not configured",
    configurations,
  };

  await mkdir(dataDirectory, { recursive: true });
  await writeFile(
    path.join(dataDirectory, "eval-results.json"),
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8",
  );
  printSummary(document);

  const publicDataset = await loadPublicDataset(
    path.join(dataDirectory, "eval-public.json"),
  );
  if (!publicDataset) {
    console.log(
      "Public CSV not prepared; skipping public metrics. Run npm run prepare:public-eval after adding data/public/sms_spam.csv.",
    );
    return;
  }

  const publicConfigurations = {} as Record<
    EvalConfiguration,
    EvalPublicConfigurationResult
  >;
  for (const plan of configurationPlans) {
    console.log(
      `Running ${plan.key} on ${publicDataset.items.length} public items...`,
    );
    publicConfigurations[plan.key] = await evaluatePublicConfiguration(
      publicDataset.items,
      plan,
    );
  }

  const publicDocument: EvalPublicResultsDocument = {
    source: publicDataset.source,
    label: publicDataset.label,
    seed: publicDataset.seed,
    sourceGeneratedAt: publicDataset.generatedAt,
    datasetSize: publicDataset.items.length,
    generatedAt: new Date().toISOString(),
    model: document.model,
    configurations: publicConfigurations,
  };
  await writeFile(
    path.join(dataDirectory, "eval-public-results.json"),
    `${JSON.stringify(publicDocument, null, 2)}\n`,
    "utf8",
  );
  printPublicSummary(publicDocument);
}

main().catch((error: unknown) => {
  console.error(
    "Evaluation failed:",
    error instanceof Error ? error.message : "Unknown error.",
  );
  process.exitCode = 1;
});
