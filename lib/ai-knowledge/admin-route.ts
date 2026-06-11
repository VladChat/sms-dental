import type { NextRequest, NextResponse } from "next/server";
import { jsonBadRequest, jsonError, jsonOk } from "../http/responses";
import { requirePlatformAdminClinic } from "../auth/admin-clinic";
import { auditAiKnowledgeSave } from "./admin-audit";
import type { SectionSaveResult } from "./section-handlers";

// Shared admin AI Knowledge section-save route runner: platform-admin guard for
// the URL clinic, JSON parse, the shared section handler, audit, and a uniform
// response. The clinic id always comes from the URL — never from membership.
export async function runAdminAiKnowledgeSave(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
  handler: (clinicId: string, actorId: string | null, body: unknown) => Promise<SectionSaveResult>,
): Promise<NextResponse> {
  const { clinicId } = await ctx.params;
  const guard = await requirePlatformAdminClinic(req, clinicId);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }

  const result = await handler(clinicId, guard.admin.userId, body);
  if (!result.ok) return jsonError(result.status, result.code, result.message);

  await auditAiKnowledgeSave(guard.admin, clinicId, result.sections);
  return jsonOk({ ok: true, facts: result.facts });
}
