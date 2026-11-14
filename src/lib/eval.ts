import type { Label } from "@/types";
import { z } from "zod";

export const EVAL_LABELS: readonly Label[] = [
  "safe",
  "suspicious",
  "scam",
];

export const EVAL_CONFIGURATIONS = [
  "heuristicsOnly",
  "llmOnly",
  "fullPipeline",
  "fullThreatIntelRegistry",
  "rulesThreatIntel",
] as const;

export type EvalConfiguration = (typeof EVAL_CONFIGURATIONS)[number];
export type EvalSplit = "tune" | "holdout";
export const PUBLIC_EVAL_SOURCE = "UCI SMS Spam Collection";
export const PUBLIC_EVAL_LABEL =
  "English, non-India, tests generalization";

export interface EvalPair {
  expected: Label;
  predicted: Label;
}

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1: number;
}

export type ConfusionMatrix = Record<Label, Record<Label, number>>;

export interface EvalMetrics {
  sampleCount: number;
  accuracy: number;
  perClass: Record<Label, ClassMetrics>;
  macroF1: number;
  confusionMatrix: ConfusionMatrix;
  scamDetection: ClassMetrics & { falsePositiveRate: number };
}

export interface EvalSampleResult {
  id: string;
  expected: Label;
  predicted: Label | "error";
  score: number | null;
  latencyMs: number;
  split: EvalSplit;
  error?: string;
}

export interface EvalAggregate {
  sampleCount: number;
  errorCount: number;
  metrics: EvalMetrics;
  averageLatencyMs: number;
  p95LatencyMs: number;
}

export interface EvalConfigurationResult {
  overall: EvalAggregate;
  tune: EvalAggregate;
  holdout: EvalAggregate;
  items: EvalSampleResult[];
}

export interface EvalPublicItem {
  id: string;
  label: "safe" | "scam";
  category: string;
  text: string;
}

export interface EvalPublicDatasetDocument {
  source: typeof PUBLIC_EVAL_SOURCE;
  label: typeof PUBLIC_EVAL_LABEL;
  seed: number;
  generatedAt: string;
  items: EvalPublicItem[];
}

export interface EvalPublicSampleResult {
  id: string;
  expected: Label;
  predicted: Label | "error";
  score: number | null;
  latencyMs: number;
  error?: string;
}

export interface EvalPublicConfigurationResult {
  overall: EvalAggregate;
  items: EvalPublicSampleResult[];
}

export interface EvalPublicResultsDocument {
  source: typeof PUBLIC_EVAL_SOURCE;
  label: typeof PUBLIC_EVAL_LABEL;
  seed: number;
  sourceGeneratedAt: string;
  datasetSize: number;
  generatedAt: string;
  model: string;
  configurations: Record<EvalConfiguration, EvalPublicConfigurationResult>;
}

export interface EvalResultsDocument {
  datasetSize: number;
  generatedAt: string;
  model: string;
  configurations: Record<EvalConfiguration, EvalConfigurationResult>;
}

const labelSchema = z.enum(["safe", "suspicious", "scam"]);
const classMetricsSchema = z.object({
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
});
const confusionMatrixSchema = z.object({
  safe: z.object({ safe: z.number(), suspicious: z.number(), scam: z.number() }),
  suspicious: z.object({
    safe: z.number(),
    suspicious: z.number(),
    scam: z.number(),
  }),
  scam: z.object({ safe: z.number(), suspicious: z.number(), scam: z.number() }),
});
const evalMetricsSchema = z.object({
  sampleCount: z.number(),
  accuracy: z.number(),
  perClass: z.object({
    safe: classMetricsSchema,
    suspicious: classMetricsSchema,
    scam: classMetricsSchema,
  }),
  macroF1: z.number(),
  confusionMatrix: confusionMatrixSchema,
  scamDetection: classMetricsSchema.extend({ falsePositiveRate: z.number() }),
});
const evalAggregateSchema = z.object({
  sampleCount: z.number(),
  errorCount: z.number(),
  metrics: evalMetricsSchema,
  averageLatencyMs: z.number(),
  p95LatencyMs: z.number(),
});
const evalSampleResultSchema = z.object({
  id: z.string(),
  expected: labelSchema,
  predicted: z.union([labelSchema, z.literal("error")]),
  score: z.number().nullable(),
  latencyMs: z.number(),
  split: z.enum(["tune", "holdout"]),
  error: z.string().optional(),
});
const evalConfigurationResultSchema = z.object({
  overall: evalAggregateSchema,
  tune: evalAggregateSchema,
  holdout: evalAggregateSchema,
  items: z.array(evalSampleResultSchema),
});

const evalPublicItemSchema = z
  .object({
    id: z.string().min(1),
    label: z.enum(["safe", "scam"]),
    category: z.string().min(1),
    text: z.string().min(1),
  })
  .strict();

export const EvalPublicDatasetSchema = z
  .object({
    source: z.literal(PUBLIC_EVAL_SOURCE),
    label: z.literal(PUBLIC_EVAL_LABEL),
    seed: z.number().int(),
    generatedAt: z.string().datetime(),
    items: z.array(evalPublicItemSchema).length(80),
  })
  .strict();

const evalPublicSampleResultSchema = z
  .object({
    id: z.string(),
    expected: labelSchema,
    predicted: z.union([labelSchema, z.literal("error")]),
    score: z.number().nullable(),
    latencyMs: z.number(),
    error: z.string().optional(),
  })
  .strict();

const evalPublicConfigurationResultSchema = z.object({
  overall: evalAggregateSchema,
  items: z.array(evalPublicSampleResultSchema),
});

const configurationSchemas = {
  heuristicsOnly: evalConfigurationResultSchema,
  llmOnly: evalConfigurationResultSchema,
  fullPipeline: evalConfigurationResultSchema,
  fullThreatIntelRegistry: evalConfigurationResultSchema,
  rulesThreatIntel: evalConfigurationResultSchema,
};

const publicConfigurationSchemas = {
  heuristicsOnly: evalPublicConfigurationResultSchema,
  llmOnly: evalPublicConfigurationResultSchema,
  fullPipeline: evalPublicConfigurationResultSchema,
  fullThreatIntelRegistry: evalPublicConfigurationResultSchema,
  rulesThreatIntel: evalPublicConfigurationResultSchema,
};

export const EvalResultsSchema = z.object({
  datasetSize: z.number(),
  generatedAt: z.string(),
  model: z.string(),
  configurations: z.object(configurationSchemas),
});

export const EvalPublicResultsSchema = z
  .object({
    source: z.literal(PUBLIC_EVAL_SOURCE),
    label: z.literal(PUBLIC_EVAL_LABEL),
    seed: z.number().int(),
    sourceGeneratedAt: z.string().datetime(),
    datasetSize: z.number().int().min(1),
    generatedAt: z.string().datetime(),
    model: z.string(),
    configurations: z.object(publicConfigurationSchemas),
  })
  .strict();

export const EvalPageResultsSchema = EvalResultsSchema.extend({
  publicDataset: EvalPublicResultsSchema.nullable(),
});

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function f1Score(precision: number, recall: number): number {
  return ratio(2 * precision * recall, precision + recall);
}

function metricsForClass(
  label: Label,
  matrix: ConfusionMatrix,
): ClassMetrics {
  const truePositive = matrix[label][label];
  const predictedCount = EVAL_LABELS.reduce(
    (total, expected) => total + matrix[expected][label],
    0,
  );
  const expectedCount = EVAL_LABELS.reduce(
    (total, predicted) => total + matrix[label][predicted],
    0,
  );
  const precision = ratio(truePositive, predictedCount);
  const recall = ratio(truePositive, expectedCount);

  return {
    precision,
    recall,
    f1: f1Score(precision, recall),
  };
}

function createConfusionMatrix(): ConfusionMatrix {
  return {
    safe: { safe: 0, suspicious: 0, scam: 0 },
    suspicious: { safe: 0, suspicious: 0, scam: 0 },
    scam: { safe: 0, suspicious: 0, scam: 0 },
  };
}

export function computeMetrics(pairs: EvalPair[]): EvalMetrics {
  const confusionMatrix = createConfusionMatrix();
  let correct = 0;
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;

  for (const { expected, predicted } of pairs) {
    confusionMatrix[expected][predicted] += 1;
    if (expected === predicted) {
      correct += 1;
    }

    const expectedFlagged = expected !== "safe";
    const predictedFlagged = predicted !== "safe";
    if (expectedFlagged && predictedFlagged) {
      truePositive += 1;
    } else if (!expectedFlagged && predictedFlagged) {
      falsePositive += 1;
    } else if (expectedFlagged && !predictedFlagged) {
      falseNegative += 1;
    } else {
      trueNegative += 1;
    }
  }

  const perClass: Record<Label, ClassMetrics> = {
    safe: metricsForClass("safe", confusionMatrix),
    suspicious: metricsForClass("suspicious", confusionMatrix),
    scam: metricsForClass("scam", confusionMatrix),
  };
  const scamPrecision = ratio(truePositive, truePositive + falsePositive);
  const scamRecall = ratio(truePositive, truePositive + falseNegative);

  return {
    sampleCount: pairs.length,
    accuracy: ratio(correct, pairs.length),
    perClass,
    macroF1:
      EVAL_LABELS.reduce((total, label) => total + perClass[label].f1, 0) /
      EVAL_LABELS.length,
    confusionMatrix,
    scamDetection: {
      precision: scamPrecision,
      recall: scamRecall,
      f1: f1Score(scamPrecision, scamRecall),
      falsePositiveRate: ratio(falsePositive, falsePositive + trueNegative),
    },
  };
}
