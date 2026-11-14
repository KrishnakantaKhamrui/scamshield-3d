import { z } from "zod";
import { runPipeline } from "@/lib/agent/orchestrator";
import { defangText } from "@/lib/security/defang";
import { guardRequest } from "@/lib/security/guard";
import type { TraceStep } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    text: z.string().min(1).max(4000),
    mode: z.enum(["message", "transcript"]).optional(),
    imageBase64: z.string().optional(),
    language: z.enum(["en", "hi", "bn"]).optional(),
  })
  .strict();

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function logRequest(
  requestId: string,
  status: number,
  latencyMs: number,
  label: string | null,
): void {
  console.info(
    JSON.stringify({
      requestId,
      route: "/api/analyze",
      status,
      latencyMs,
      label,
    }),
  );
}

function sseEvent(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function yieldToStream(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guardRequest(request);
  if (blocked) {
    return blocked;
  }

  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    logRequest(requestId, 400, Date.now() - startedAt, null);
    return jsonError("Request body must be valid JSON.", 400);
  }

  const parsedBody = requestSchema.safeParse(requestBody);
  if (!parsedBody.success) {
    logRequest(requestId, 400, Date.now() - startedAt, null);
    return jsonError("Invalid request body.", 400);
  }
  if (parsedBody.data.text.trim().length === 0) {
    logRequest(requestId, 400, Date.now() - startedAt, null);
    return jsonError("Text is required.", 400);
  }

  const { text } = parsedBody.data;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown): void => {
        if (cancelled) {
          return;
        }
        try {
          controller.enqueue(sseEvent(data));
        } catch {
          cancelled = true;
        }
      };

      try {
        const verdict = await runPipeline(text, {}, async (step: TraceStep) => {
          send({ type: "step", ...step, detail: defangText(step.detail) });
          await yieldToStream();
        });
        await yieldToStream();
        send({ type: "final", verdict });
        logRequest(requestId, 200, Date.now() - startedAt, verdict.label);
      } catch {
        send({
          type: "error",
          message: "Analysis could not be completed. Please try again.",
        });
        logRequest(requestId, 500, Date.now() - startedAt, null);
      } finally {
        if (!cancelled) {
          try {
            controller.close();
          } catch {
            cancelled = true;
          }
        }
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
