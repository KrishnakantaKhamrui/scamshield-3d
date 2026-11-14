import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { embedText } from "@/lib/gemini";
import { cosineSimilarity } from "@/lib/utils";
import {
  scamEmbeddingsSchema,
  scamPatternsSchema,
  type ScamEmbedding,
} from "@/lib/agent/schemas";
import type { ScamPattern } from "@/types";

interface KnowledgeBase {
  patterns: ScamPattern[];
  embeddings: ScamEmbedding[];
}

let knowledgeBasePromise: Promise<KnowledgeBase> | undefined;

async function loadKnowledgeBase(): Promise<KnowledgeBase> {
  if (!knowledgeBasePromise) {
    knowledgeBasePromise = (async () => {
      const dataDirectory = path.resolve(process.cwd(), "data");
      const [patternsJson, embeddingsJson] = await Promise.all([
        readFile(path.join(dataDirectory, "scam-patterns.json"), "utf8"),
        readFile(path.join(dataDirectory, "scam-embeddings.json"), "utf8"),
      ]);

      return {
        patterns: scamPatternsSchema.parse(JSON.parse(patternsJson)),
        embeddings: scamEmbeddingsSchema.parse(JSON.parse(embeddingsJson)),
      };
    })();
  }

  return knowledgeBasePromise;
}

export async function retrieveSimilar(
  redactedText: string,
  topK = 3,
): Promise<{ pattern: ScamPattern; similarity: number }[]> {
  let queryEmbedding: number[];

  try {
    const [embedding] = await embedText([redactedText]);
    if (!embedding) {
      throw new Error("Gemini returned no embedding for the query.");
    }
    queryEmbedding = embedding;
  } catch {
    return [];
  }

  const { patterns, embeddings } = await loadKnowledgeBase();
  const patternsById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  const matches = embeddings.flatMap(({ id, embedding }) => {
    const pattern = patternsById.get(id);
    return pattern
      ? [{ pattern, similarity: cosineSimilarity(queryEmbedding, embedding) }]
      : [];
  });

  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.max(0, Math.floor(topK)));
}
