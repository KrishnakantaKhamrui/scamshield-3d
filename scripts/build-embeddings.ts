import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { GoogleGenAI } from "@google/genai";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  scamPatternsSchema,
  type ScamEmbedding,
} from "../src/lib/agent/schemas";

const BATCH_SIZE = 20;

if (
  !process.env.GEMINI_API_KEY?.trim() ||
  !process.env.GEMINI_EMBED_MODEL?.trim()
) {
  dotenv.config({ path: path.resolve(process.cwd(), "..", ".env.local") });
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_EMBED_MODEL?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing from .env.local.");
  }
  if (!model) {
    throw new Error("GEMINI_EMBED_MODEL is missing from .env.local.");
  }

  const dataDirectory = path.resolve(process.cwd(), "data");
  const patternsPath = path.join(dataDirectory, "scam-patterns.json");
  const patterns = scamPatternsSchema.parse(
    JSON.parse(await readFile(patternsPath, "utf8")),
  );
  const texts = patterns.map((pattern) =>
    [
      pattern.type,
      pattern.title,
      pattern.description,
      pattern.examplePhrases.join(" "),
    ].join(" "),
  );

  const ai = new GoogleGenAI({ apiKey });
  const results: ScamEmbedding[] = [];
  let vectorLength = 0;

  for (let offset = 0; offset < texts.length; offset += BATCH_SIZE) {
    const batch = texts.slice(offset, offset + BATCH_SIZE);
    const response = await ai.models.embedContent({
      model,
      contents: batch.map((text) => ({
        role: "user",
        parts: [{ text }],
      })),
    });
    const embeddings = response.embeddings;

    if (!embeddings || embeddings.length !== batch.length) {
      throw new Error(
        `Gemini returned ${embeddings?.length ?? 0} embeddings for a batch of ${batch.length}.`,
      );
    }

    for (let index = 0; index < embeddings.length; index += 1) {
      const values = embeddings[index].values;
      if (!values) {
        throw new Error("Gemini returned an embedding without vector values.");
      }
      if (vectorLength !== 0 && values.length !== vectorLength) {
        throw new Error("Gemini returned embeddings with inconsistent lengths.");
      }

      vectorLength = values.length;
      results.push({
        id: patterns[offset + index].id,
        embedding: values,
      });
    }
  }

  await writeFile(
    path.join(dataDirectory, "scam-embeddings.json"),
    `${JSON.stringify(results, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Built embeddings for ${results.length} patterns; vector length: ${vectorLength}.`,
  );
}

main().catch((error: unknown) => {
  console.error(
    "Embedding build failed:",
    error instanceof Error ? error.message : "Unknown error.",
  );
  process.exitCode = 1;
});
