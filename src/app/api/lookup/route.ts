import { z } from "zod";
import {
  hashValue,
  lookupEntitiesWithStatus,
  normalizeValue,
} from "@/lib/registry";
import { guardRequest } from "@/lib/security/guard";
import type { RegistryEntityType } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const lookupTypeSchema = z.enum(["phone", "upi", "url", "domain"]);

export async function GET(request: Request): Promise<Response> {
  const blocked = guardRequest(request);
  if (blocked) {
    return blocked;
  }

  const parameters = new URL(request.url).searchParams;
  const parsedType = lookupTypeSchema.safeParse(parameters.get("type"));
  const value = parameters.get("value");
  if (!parsedType.success || !value || value.length > 512) {
    return Response.json({ error: "Invalid lookup request." }, { status: 400 });
  }

  const type: RegistryEntityType = parsedType.data;
  let normalizedValue: string;
  try {
    normalizedValue = normalizeValue(type, value);
  } catch {
    return Response.json(
      { error: "The submitted value is not valid for this type." },
      { status: 400 },
    );
  }

  let valueHash: string;
  try {
    valueHash = hashValue(type, normalizedValue);
  } catch {
    return Response.json(
      { error: "The lookup service is not configured." },
      { status: 503 },
    );
  }

  const result = await lookupEntitiesWithStatus([{ type, valueHash }]);
  if (!result.available) {
    return Response.json(
      { error: "Lookup is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { count: result.hits[0]?.count ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
