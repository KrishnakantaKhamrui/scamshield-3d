import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { classify } from "../src/lib/agent/classifier";
import { detectInjection } from "../src/lib/agent/injectionGuard";
import { redactPII } from "../src/lib/agent/privacy";
import { checkSender } from "../src/lib/agent/senderChecker";
import { checkUrls } from "../src/lib/agent/urlChecker";
import type { EvalItem } from "../src/types";

const evalItemsSchema = z.array(
  z.object({
    id: z.string(),
    label: z.enum(["safe", "suspicious", "scam"]),
    category: z.string(),
    split: z.enum(["tune", "holdout"]),
    text: z.string(),
    adversarial: z.boolean().optional(),
  }),
);

async function main(): Promise<void> {
  const datasetPath = path.resolve(process.cwd(), "data", "eval-set.json");
  const items: EvalItem[] = evalItemsSchema.parse(
    JSON.parse(await readFile(datasetPath, "utf8")),
  );

  for (const item of items) {
    const privacy = redactPII(item.text);
    const injection = detectInjection(item.text);
    const urls = checkUrls(item.text);
    const sender = checkSender(item.text);
    const classification = classify(item.text);

    console.log(
      [
        item.id,
        `expected=${item.label}`,
        `heuristic=${classification.score}`,
        `redactions=${privacy.count}`,
        `injection=${injection.detected}`,
        `urls=${urls.urls.length}`,
        `sender=${sender.score}`,
      ].join("\t"),
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    "Tool smoke test failed:",
    error instanceof Error ? error.message : "Unknown error.",
  );
  process.exitCode = 1;
});
