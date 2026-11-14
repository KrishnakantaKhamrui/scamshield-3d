import * as dotenv from "dotenv";
import path from "node:path";
import { VerdictSchema } from "../src/lib/agent/schemas";
import { runPipeline } from "../src/lib/agent/orchestrator";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
if (!process.env.GEMINI_API_KEY?.trim()) {
  dotenv.config({ path: path.resolve(process.cwd(), "..", ".env.local") });
}

const samples = [
  {
    name: "safe",
    expected: "safe",
    text: "Your OTP for account login is 245831. Do not share it with anyone; banks never ask for your OTP.",
  },
  {
    name: "suspicious",
    expected: "suspicious",
    text: "Your bank account will be blocked today. Verify your KYC immediately at hdfc-kyc-update.online.",
  },
  {
    name: "scam",
    expected: "scam",
    text: "URGENT! CBI will arrest you today unless you transfer 10000 immediately. Share your OTP now and keep this secret.",
  },
] as const;

async function main(): Promise<void> {
  for (const sample of samples) {
    const verdict = VerdictSchema.parse(await runPipeline(sample.text));
    const serialized = JSON.stringify(verdict);
    const checkedVerdict = VerdictSchema.parse(JSON.parse(serialized));

    if (checkedVerdict.label !== sample.expected) {
      throw new Error(
        `${sample.name} sample expected ${sample.expected}, got ${checkedVerdict.label}.`,
      );
    }
    if (
      !/[\u0900-\u097f]/.test(checkedVerdict.explanation.hi) ||
      !/[\u0980-\u09ff]/.test(checkedVerdict.explanation.bn)
    ) {
      throw new Error(`${sample.name} sample is missing a Hindi or Bengali explanation.`);
    }

    console.log(`${sample.name}:\n${JSON.stringify(checkedVerdict, null, 2)}`);
  }
}

main().catch((error: unknown) => {
  console.error(
    "Pipeline sample check failed:",
    error instanceof Error ? error.message : "Unknown error.",
  );
  process.exitCode = 1;
});
