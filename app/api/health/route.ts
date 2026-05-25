import { jsonOk } from "@/lib/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, unauthenticated liveness probe. Returns safe, fixed metadata only.
// Never include secret presence, env state, or database state here.
export function GET() {
  return jsonOk({
    ok: true,
    service: "missed-calls-dental",
    version: "foundation-v1",
  });
}
