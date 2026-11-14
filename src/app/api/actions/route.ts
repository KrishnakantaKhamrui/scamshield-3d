import { guardRequest } from "@/lib/security/guard";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const blocked = guardRequest(request);
  if (blocked) {
    return blocked;
  }

  return Response.json({ error: "Not found." }, { status: 404 });
}
