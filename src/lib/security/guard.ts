import { clientIp, rateLimit } from "@/lib/security/rateLimit";

const MAX_CONTENT_LENGTH = 6_000_000;

function forbidden(): Response {
  return Response.json({ error: "Forbidden." }, { status: 403 });
}

export function guardRequest(request: Request, limit = 10): Response | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (origin) {
    if (!host) {
      return forbidden();
    }

    try {
      if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
        return forbidden();
      }
    } catch {
      return forbidden();
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    return Response.json({ error: "Invalid request size." }, { status: 400 });
  }
  if (contentLength > MAX_CONTENT_LENGTH) {
    return Response.json({ error: "Payload too large." }, { status: 413 });
  }

  const result = rateLimit(clientIp(request), limit);
  if (!result.ok) {
    return Response.json(
      { error: "Too many requests. Please wait a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  return null;
}
