import { VerdictSchema } from "@/lib/agent/schemas";
import type { TraceStep, Verdict } from "@/types";

export interface AnalyzeRequestBody {
  text: string;
  mode?: "message" | "transcript";
  imageBase64?: string;
  language?: "en" | "hi" | "bn";
}

export interface AnalyzeStreamCallbacks {
  onStep: (step: TraceStep) => void;
  onFinal: (verdict: Verdict) => void;
  onError: (message: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTraceStep(value: unknown): value is TraceStep {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    (value.status === "pending" ||
      value.status === "running" ||
      value.status === "done" ||
      value.status === "error") &&
    typeof value.detail === "string" &&
    typeof value.ms === "number" &&
    Number.isFinite(value.ms)
  );
}

function isSseEvent(value: unknown): value is Record<string, unknown> & {
  type: string;
} {
  return isRecord(value) && typeof value.type === "string";
}

function getErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return typeof value.error === "string" ? value.error : undefined;
}

export async function analyzeStream(
  body: AnalyzeRequestBody,
  { onStep, onFinal, onError }: AnalyzeStreamCallbacks,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    onError("Could not connect to the analysis service.");
    return;
  }

  if (!response.ok) {
    let message = `Analysis request failed (${response.status}).`;
    try {
      message = getErrorMessage(await response.json()) ?? message;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    onError(message);
    return;
  }

  if (!response.body) {
    onError("The analysis service returned an empty stream.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines: string[] = [];
  let receivedFinal = false;
  let receivedError = false;

  const dispatchData = (data: string): void => {
    let value: unknown;
    try {
      value = JSON.parse(data);
    } catch {
      receivedError = true;
      onError("The analysis service returned an invalid event.");
      return;
    }

    if (!isSseEvent(value)) {
      receivedError = true;
      onError("The analysis service returned an invalid event.");
      return;
    }

    if (value.type === "step") {
      if (!isTraceStep(value)) {
        receivedError = true;
        onError("The analysis service returned an invalid step.");
        return;
      }
      onStep(value);
      return;
    }

    if (value.type === "final") {
      const verdict = VerdictSchema.safeParse(value.verdict);
      if (!verdict.success) {
        receivedError = true;
        onError("The analysis service returned an invalid verdict.");
        return;
      }
      receivedFinal = true;
      onFinal(verdict.data);
      return;
    }

    if (value.type === "error") {
      receivedError = true;
      onError(
        typeof value.message === "string"
          ? value.message
          : "Analysis could not be completed.",
      );
    }
  };

  const processLine = (line: string): void => {
    if (line === "") {
      if (dataLines.length > 0) {
        dispatchData(dataLines.join("\n"));
        dataLines = [];
      }
      return;
    }
    if (line.startsWith(":")) {
      return;
    }
    if (line.startsWith("data:")) {
      const data = line.slice(5);
      dataLines.push(data.startsWith(" ") ? data.slice(1) : data);
    }
  };

  try {
    while (!receivedFinal && !receivedError) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch {
        receivedError = true;
        onError("The analysis stream was interrupted.");
        break;
      }

      if (result.done) {
        buffer += decoder.decode();
        if (buffer.length > 0) {
          processLine(buffer);
          buffer = "";
        }
        if (dataLines.length > 0 && !receivedFinal && !receivedError) {
          dispatchData(dataLines.join("\n"));
          dataLines = [];
        }
        break;
      }

      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        processLine(line);
        if (receivedFinal || receivedError) {
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!receivedFinal && !receivedError) {
    onError("The analysis stream ended before a result was received.");
  }
}
