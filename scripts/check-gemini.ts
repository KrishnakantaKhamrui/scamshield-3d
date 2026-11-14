/**
 * Run: npm run check:gemini
 * Verifies your API key, lists models you can use, and tests
 * text generation + embeddings with the models set in .env.local.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { GoogleGenAI } from "@google/genai";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  const embedModel = process.env.GEMINI_EMBED_MODEL;

  if (!apiKey) throw new Error("GEMINI_API_KEY missing in .env.local");
  if (!model || !embedModel) throw new Error("GEMINI_MODEL / GEMINI_EMBED_MODEL missing in .env.local");

  const ai = new GoogleGenAI({ apiKey });

  console.log("\n1) Models available to your key (look for 'flash' and 'embedding'):");
  const pager = await ai.models.list();
  for await (const m of pager) {
    if (/flash|embedding/i.test(m.name ?? "")) console.log("   ", m.name);
  }

  console.log(`\n2) Text generation with "${model}"...`);
  const gen = await ai.models.generateContent({
    model,
    contents: 'Reply with exactly: {"ok": true}',
  });
  console.log("   Response:", gen.text);

  console.log(`\n3) Embedding with "${embedModel}"...`);
  const emb = await ai.models.embedContent({
    model: embedModel,
    contents: ["Your KYC will expire, click the link"],
  });
  const vec = emb.embeddings?.[0]?.values ?? [];
  console.log("   Vector length:", vec.length);

  console.log("\nAll good. If a model name above failed, copy a current one from the list in step 1 into .env.local");
}

main().catch((e) => {
  console.error("\nCheck failed:", e?.message ?? e);
  process.exit(1);
});
