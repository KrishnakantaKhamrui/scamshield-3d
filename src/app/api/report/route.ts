import { createHash } from "node:crypto";
import { z } from "zod";
import { clientIp } from "@/lib/security/rateLimit";
import { guardRequest } from "@/lib/security/guard";
import { hashValue, normalizeValue, reportEntity } from "@/lib/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reportSchema = z
  .object({
    type: z.enum(["phone", "upi", "url", "domain"]),
    value: z.string().trim().min(1).max(512),
    category: z.string().trim().min(1).max(120),
  })
  .strict();

const duplicateReports = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 60 * 60 * 1000;

function isDuplicate(key: string, now: number): boolean {
  for (const [storedKey, expiresAt] of duplicateReports) {
    if (now >= expiresAt) {
      duplicateReports.delete(storedKey);
    }
  }
  const expiresAt = duplicateReports.get(key);
  if (expiresAt && now < expiresAt) {
    return true;
  }
  while (duplicateReports.size >= 5000) {
    const oldest = duplicateReports.keys().next();
    if (oldest.done) {
      break;
    }
    duplicateReports.delete(oldest.value);
  }
  return false;
}

function duplicateKey(ip: string, valueHash: string): string {
  return createHash("sha256")
    .update(`${ip}\0${valueHash}`, "utf8")
    .digest("hex");
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guardRequest(request, 3);
  if (blocked) {
    return blocked;
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return Response.json({ error: "Invalid report request." }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(requestBody);
  if (!parsed.success) {
    return Response.json({ error: "Invalid report request." }, { status: 400 });
  }

  let normalizedValue: string;
  try {
    normalizedValue = normalizeValue(parsed.data.type, parsed.data.value);
  } catch {
    return Response.json(
      { error: "The submitted value is not valid for this type." },
      { status: 400 },
    );
  }

  let valueHash: string;
  try {
    valueHash = hashValue(parsed.data.type, normalizedValue);
  } catch {
    return Response.json(
      { error: "The reporting service is not configured." },
      { status: 503 },
    );
  }

  const key = duplicateKey(clientIp(request), valueHash);
  const now = Date.now();
  if (isDuplicate(key, now)) {
    return Response.json(
      { error: "This value was already reported recently." },
      { status: 409 },
    );
  }
  duplicateReports.set(key, now + DUPLICATE_WINDOW_MS);

  const saved = await reportEntity(
    parsed.data.type,
    normalizedValue,
    parsed.data.category,
  );
  if (!saved) {
    duplicateReports.delete(key);
    return Response.json(
      { error: "The reporting service is temporarily unavailable." },
      { status: 503 },
    );
  }

  return Response.json({ ok: true }, { status: 200 });
}
