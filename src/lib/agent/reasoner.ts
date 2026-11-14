import { generateJSON } from "@/lib/gemini";
import { buildReasonerPrompt, SYSTEM_INSTRUCTION } from "@/lib/prompts";
import {
  ReasonerOutputSchema,
  type ReasonerOutput,
} from "@/lib/agent/schemas";
import type { AgentEvidence } from "@/types";
import { ZodError } from "zod";

interface ValidationAttempt {
  output?: ReasonerOutput;
  issue?: string;
}

function isInvalidJsonResponse(error: unknown): boolean {
  return (
    error instanceof SyntaxError ||
    error instanceof ZodError ||
    (error instanceof Error &&
      error.message === "Gemini returned an empty JSON response.")
  );
}

async function requestValidOutput(
  prompt: string,
  evidence: AgentEvidence,
): Promise<ValidationAttempt> {
  let response: Record<string, unknown>;

  try {
    response = await generateJSON(prompt, SYSTEM_INSTRUCTION);
  } catch (error) {
    if (isInvalidJsonResponse(error)) {
      return { issue: "The response was not valid JSON." };
    }
    throw error;
  }

  const parsed = ReasonerOutputSchema.safeParse(response);
  if (!parsed.success) {
    return { issue: "The response did not match the reasoner schema." };
  }
  if (
    parsed.data.highlightedPhrases.some(
      (phrase) => !evidence.redactedText.includes(phrase),
    )
  ) {
    return {
      issue: "A highlighted phrase was not an exact substring of the message.",
    };
  }

  return { output: parsed.data };
}

export async function runReasoner(
  evidence: AgentEvidence,
): Promise<ReasonerOutput> {
  const prompt = buildReasonerPrompt(evidence);
  const firstAttempt = await requestValidOutput(prompt, evidence);
  if (firstAttempt.output) {
    return firstAttempt.output;
  }

  const strictPrompt = `${prompt}

Strict retry reminder: return valid JSON only, with no markdown or extra fields. Follow every schema constraint, including script requirements and exact highlighted substrings.`;
  const secondAttempt = await requestValidOutput(strictPrompt, evidence);
  if (secondAttempt.output) {
    return secondAttempt.output;
  }

  throw new Error(
    `Gemini response failed validation after one retry. ${secondAttempt.issue ?? firstAttempt.issue ?? "Invalid response."}`,
  );
}
