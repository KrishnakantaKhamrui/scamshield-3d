import { z } from "zod";
import { runPipeline } from "@/lib/agent/orchestrator";
import { defangText } from "@/lib/security/defang";
import { clientIp, rateLimit } from "@/lib/security/rateLimit";
import type { Label } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 30_000;
const installTokenPattern = /^[A-Za-z0-9_-]{40,64}$/;
const requestSchema = z
  .object({
    text: z.string().min(20).max(6000),
  })
  .strict();

function configuredExtensionOrigin(): string | null {
  const extensionId = process.env.CHROME_EXTENSION_ID;
  if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) {
    return null;
  }
  return `chrome-extension://${extensionId}`;
}

function corsHeaders(origin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-ScamShield-Install-Token",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
}

function jsonResponse(
  body: unknown,
  status: number,
  headers?: Headers,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function logRequest(
  requestId: string,
  status: number,
  latencyMs: number,
  label: Label | null,
): void {
  console.info(
    JSON.stringify({
      requestId,
      route: "/api/extension/analyze",
      status,
      latencyMs,
      label,
    }),
  );
}

async function readLimitedBody(
  request: Request,
): Promise<{ body: string; tooLarge: boolean }> {
  if (!request.body) {
    return { body: "", tooLarge: false };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { body: "", tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return { body: "", tooLarge: false };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(bytes), tooLarge: false };
}

export function OPTIONS(request: Request): Response {
  const allowedOrigin = configuredExtensionOrigin();
  const origin = request.headers.get("origin");
  if (!allowedOrigin || origin !== allowedOrigin) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const allowedOrigin = configuredExtensionOrigin();
  const origin = request.headers.get("origin");

  if (!allowedOrigin) {
    logRequest(requestId, 503, Date.now() - startedAt, null);
    return Response.json(
      { error: "Extension analysis is not configured." },
      { status: 503 },
    );
  }
  if (origin !== allowedOrigin) {
    logRequest(requestId, 403, Date.now() - startedAt, null);
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const headers = corsHeaders(allowedOrigin);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    logRequest(requestId, 400, Date.now() - startedAt, null);
    return jsonResponse({ error: "Invalid request size." }, 400, headers);
  }
  if (contentLength > MAX_BODY_BYTES) {
    logRequest(requestId, 413, Date.now() - startedAt, null);
    return jsonResponse({ error: "Request is too large." }, 413, headers);
  }

  const installToken = request.headers.get("x-scamshield-install-token") ?? "";
  if (!installTokenPattern.test(installToken)) {
    logRequest(requestId, 401, Date.now() - startedAt, null);
    return jsonResponse({ error: "Install token is required." }, 401, headers);
  }

  const ip = clientIp(request);
  if (
    !rateLimit(`extension-ip:${ip}`, 6).ok ||
    !rateLimit(`extension-token:${installToken}`, 6).ok
  ) {
    logRequest(requestId, 429, Date.now() - startedAt, null);
    headers.set("Retry-After", "60");
    return jsonResponse(
      { error: "Too many extension requests. Please wait a minute." },
      429,
      headers,
    );
  }

  const { body, tooLarge } = await readLimitedBody(request);
  if (tooLarge) {
    logRequest(requestId, 413, Date.now() - startedAt, null);
    return jsonResponse({ error: "Request is too large." }, 413, headers);
  }

  let requestBody: unknown;
  try {
    requestBody = JSON.parse(body);
  } catch {
    logRequest(requestId, 400, Date.now() - startedAt, null);
    return jsonResponse({ error: "Request body must be valid JSON." }, 400, headers);
  }

  const parsed = requestSchema.safeParse(requestBody);
  if (!parsed.success || parsed.data.text.trim().length < 20) {
    logRequest(requestId, 400, Date.now() - startedAt, null);
    return jsonResponse({ error: "Invalid request body." }, 400, headers);
  }

  try {
    const verdict = await runPipeline(parsed.data.text);
    logRequest(requestId, 200, Date.now() - startedAt, verdict.label);
    return jsonResponse(
      {
        label: verdict.label,
        score: verdict.score,
        scamType: defangText(verdict.scamType).slice(0, 100),
        reasons: verdict.reasons
          .slice(0, 3)
          .map((reason) => defangText(reason).slice(0, 180)),
      },
      200,
      headers,
    );
  } catch {
    logRequest(requestId, 500, Date.now() - startedAt, null);
    return jsonResponse(
      { error: "Extension analysis could not be completed." },
      500,
      headers,
    );
  }
}
