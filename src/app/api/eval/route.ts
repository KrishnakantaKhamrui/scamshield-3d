import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { runPipeline } from "@/lib/agent/orchestrator";
import {
  EvalPublicDatasetSchema,
  EvalPublicResultsSchema,
  EvalResultsSchema,
} from "@/lib/eval";
import type { EvalPublicResultsDocument } from "@/lib/eval";
import { guardRequest } from "@/lib/security/guard";
import type { EvalItem } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const evalItemSchema = z.object({
  id: z.string().min(1),
  label: z.enum(["safe", "suspicious", "scam"]),
  category: z.string().min(1),
  split: z.enum(["tune", "holdout"]),
  text: z.string().min(1),
  adversarial: z.boolean().optional(),
});

let lastLiveEvalAt = 0;

async function readJsonFile(fileName: string): Promise<unknown> {
  const filePath = path.join(process.cwd(), "data", fileName);
  return JSON.parse(await readFile(filePath, "utf8"));
}

function chooseRandomItems(items: EvalItem[], count: number): EvalItem[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled.slice(0, Math.min(count, 5));
}

export async function GET(request: Request): Promise<Response> {
  const blocked = guardRequest(request);
  if (blocked) {
    return blocked;
  }

  try {
    const results = EvalResultsSchema.parse(
      await readJsonFile("eval-results.json"),
    );
    let publicDataset: EvalPublicResultsDocument | null = null;
    try {
      const [input, output] = await Promise.all([
        readJsonFile("eval-public.json"),
        readJsonFile("eval-public-results.json"),
      ]);
      const parsedInput = EvalPublicDatasetSchema.parse(input);
      const parsedOutput = EvalPublicResultsSchema.parse(output);
      if (
        parsedOutput.sourceGeneratedAt === parsedInput.generatedAt &&
        parsedOutput.datasetSize === parsedInput.items.length
      ) {
        publicDataset = parsedOutput;
      }
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }

    return Response.json({ ...results, publicDataset }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Evaluation results are not available. Run npm run eval first." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guardRequest(request);
  if (blocked) {
    return blocked;
  }

  const now = Date.now();
  if (now - lastLiveEvalAt < 10_000) {
    return Response.json(
      { error: "Please wait before running another live evaluation." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((10_000 - (now - lastLiveEvalAt)) / 1000)),
        },
      },
    );
  }
  lastLiveEvalAt = now;

  let items: EvalItem[];
  try {
    const parsedItems = z.array(evalItemSchema).min(1).parse(
      await readJsonFile("eval-set.json"),
    );
    items = parsedItems;
  } catch {
    return Response.json(
      { error: "The evaluation dataset could not be loaded." },
      { status: 500 },
    );
  }

  const selectedItems = chooseRandomItems(items, 5);
  const samples: Array<{
    id: string;
    expected: EvalItem["label"];
    predicted: EvalItem["label"] | "error";
    score: number | null;
    latencyMs: number;
    usedFallback: boolean;
  }> = [];
  for (let offset = 0; offset < selectedItems.length; offset += 2) {
    const batch = await Promise.all(
      selectedItems.slice(offset, offset + 2).map(async (item) => {
      const start = Date.now();
      try {
        const verdict = await runPipeline(item.text);
        return {
          id: item.id,
          expected: item.label,
          predicted: verdict.label,
          score: verdict.score,
          latencyMs: Date.now() - start,
          usedFallback: verdict.meta.usedFallback,
        };
      } catch {
        return {
          id: item.id,
          expected: item.label,
          predicted: "error" as const,
          score: null,
          latencyMs: Date.now() - start,
          usedFallback: false,
        };
      }
      }),
    );
    samples.push(...batch);
  }

  return Response.json(
    { datasetSize: items.length, samples },
    { headers: { "Cache-Control": "no-store" } },
  );
}
