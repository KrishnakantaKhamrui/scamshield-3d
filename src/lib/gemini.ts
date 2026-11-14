import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

let client: GoogleGenAI | undefined;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  client ??= new GoogleGenAI({ apiKey });
  return client;
}

function getModel(name: "GEMINI_MODEL" | "GEMINI_EMBED_MODEL"): string {
  const model = process.env[name];
  if (!model) {
    throw new Error(`${name} is not configured on the server.`);
  }

  return model;
}

function isRetryableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown };
  };
  const status = Number(
    candidate.status ?? candidate.response?.status ?? candidate.code,
  );
  return status === 429 || (status >= 500 && status <= 599);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateJSON(
  prompt: string,
  systemInstruction: string,
): Promise<Record<string, unknown>> {
  const model = getModel("GEMINI_MODEL");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await getGeminiClient().models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      });

      if (!response.text) {
        throw new Error("Gemini returned an empty JSON response.");
      }

      return z.record(z.string(), z.unknown()).parse(JSON.parse(response.text));
    } catch (error) {
      if (attempt === 2 || !isRetryableError(error)) {
        throw error;
      }

      await wait(500 * 2 ** attempt);
    }
  }

  throw new Error("Gemini JSON generation failed after retries.");
}

export async function embedText(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const response = await getGeminiClient().models.embedContent({
    model: getModel("GEMINI_EMBED_MODEL"),
    contents: texts.map((text) => ({
      role: "user",
      parts: [{ text }],
    })),
  });
  const embeddings = response.embeddings;

  if (!embeddings || embeddings.length !== texts.length) {
    throw new Error("Gemini returned an unexpected number of embeddings.");
  }

  return embeddings.map((embedding) => {
    if (!embedding.values) {
      throw new Error("Gemini returned an embedding without vector values.");
    }
    return embedding.values;
  });
}
