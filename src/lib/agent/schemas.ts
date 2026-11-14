import { z } from "zod";

const explanationSentenceCount = (value: string): number =>
  value.trim().split(/[.!?।]+/).filter(Boolean).length;

const englishExplanationSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      explanationSentenceCount(value) >= 2 &&
      explanationSentenceCount(value) <= 3,
    "Explanation must contain 2 to 3 sentences.",
  );

const hindiExplanationSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      explanationSentenceCount(value) >= 2 &&
      explanationSentenceCount(value) <= 3,
    "Explanation must contain 2 to 3 sentences.",
  )
  .refine((value) => /[\u0900-\u097f]/.test(value), "Use Devanagari script.");

const bengaliExplanationSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      explanationSentenceCount(value) >= 2 &&
      explanationSentenceCount(value) <= 3,
    "Explanation must contain 2 to 3 sentences.",
  )
  .refine((value) => /[\u0980-\u09ff]/.test(value), "Use Bengali script.");

export const killChainStepSchema = z.enum([
  "hook",
  "authority",
  "urgency",
  "isolation",
  "payment_ask",
]);

export const threatIntelSourceSchema = z
  .object({
    name: z.string().min(1),
    hit: z.boolean(),
    detail: z.string().optional(),
  })
  .strict();

export const threatIntelEvidenceSchema = z
  .object({
    score: z.number().min(0).max(100),
    flags: z.array(z.string()),
    sources: z.array(threatIntelSourceSchema),
    skipped: z.array(z.string()),
  })
  .strict();

export const registryHitSchema = z
  .object({
    type: z.enum(["phone", "upi", "url", "domain"]),
    displayValue: z.string(),
    category: z.string(),
    count: z.number().int().min(1),
  })
  .strict();

export const toolEvidenceSchema = z
  .object({
    tool: z.string().min(1),
    status: z.enum(["safe", "suspicious", "scam", "unknown"]),
    summary: z.string(),
    details: z.array(z.string()),
    score: z.number().min(0).max(100).optional(),
    threatIntel: threatIntelEvidenceSchema.optional(),
    registry: z.array(registryHitSchema).optional(),
  })
  .strict();

export const ReasonerOutputSchema = z
  .object({
    label: z.enum(["safe", "suspicious", "scam"]),
    score: z.number().min(0).max(100),
    confidence: z.number().min(0).max(1),
    scamType: z.string().min(1),
    highlightedPhrases: z.array(z.string().min(1)),
    redFlags: z.array(z.string()),
    greenFlags: z.array(z.string()),
    killChain: z.array(killChainStepSchema),
    reasons: z.array(z.string().min(1).max(180)).max(5),
    explanation: z
      .object({
        en: englishExplanationSchema,
        hi: hindiExplanationSchema,
        bn: bengaliExplanationSchema,
      })
      .strict(),
  })
  .strict();

export const VerdictSchema = z
  .object({
    label: z.enum(["safe", "suspicious", "scam"]),
    score: z.number().min(0).max(100),
    confidence: z.number().min(0).max(1),
    scamType: z.string(),
    highlightedPhrases: z.array(z.string()),
    redFlags: z.array(z.string()),
    greenFlags: z.array(z.string()),
    killChain: z.array(killChainStepSchema),
    reasons: z.array(z.string()).max(5),
    explanation: z
      .object({
        en: z.string(),
        hi: z.string(),
        bn: z.string(),
      })
      .strict(),
    toolEvidence: z.array(toolEvidenceSchema),
    meta: z
      .object({
        redactedCount: z.number().int().min(0),
        injectionDetected: z.boolean(),
        latencyMs: z.number().min(0),
        usedFallback: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const scamPatternSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  examplePhrases: z.array(z.string()),
  redFlags: z.array(z.string()),
  whatToDo: z.array(z.string()),
  severity: z.number(),
});

export const scamPatternsSchema = z.array(scamPatternSchema);

export const scamEmbeddingSchema = z.object({
  id: z.string(),
  embedding: z.array(z.number()),
});

export const scamEmbeddingsSchema = z.array(scamEmbeddingSchema);

export type ScamEmbedding = z.infer<typeof scamEmbeddingSchema>;
export type ReasonerOutput = z.infer<typeof ReasonerOutputSchema>;
