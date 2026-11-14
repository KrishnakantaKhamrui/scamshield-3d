import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { GoogleGenAI } from "@google/genai";

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  const embedModel = process.env.GEMINI_EMBED_MODEL;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing in .env.local");
  }
  if (!model || !embedModel) {
    throw new Error("GEMINI_MODEL / GEMINI_EMBED_MODEL missing in .env.local");
  }

  const ai = new GoogleGenAI({ apiKey });
  const generation = await ai.models.generateContent({
    model,
    contents: 'Reply with exactly: {"ok": true}',
  });
  console.log("Generation response:", generation.text);

  const embedding = await ai.models.embedContent({
    model: embedModel,
    contents: ["Test message"],
  });
  console.log("Embedding length:", embedding.embeddings?.[0]?.values?.length ?? 0);
}

main().catch((error: unknown) => {
  console.error("Gemini check failed:", error);
  process.exitCode = 1;
});
