import { NextResponse, type NextRequest } from "next/server";

import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../lib/http/responses";
import {
  resolveAuthClinicAccess,
  type AuthClinicAccessResult,
} from "../../../../lib/auth/access";
import {
  listClinicAiKnowledgeEntries,
  upsertClinicAiKnowledgeEntry,
} from "../../../../lib/db/ai-knowledge";
import { validateAiKnowledgeUpdate } from "../../../../lib/ai-knowledge/entries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// AI Front Desk Knowledge — owner/admin account API (foundation only).
//
// This manages the clinic-approved answer library a FUTURE AI assistant may
// use. Nothing here sends SMS, calls an AI provider, crawls websites, or
// changes patient-facing behavior. Front-desk users cannot manage AI knowledge.

type OwnerAdminAccessCheck =
  | { allowed: false; response: NextResponse }
  | { allowed: true; access: Extract<AuthClinicAccessResult, { ok: true }> };

async function requireOwnerAdminAccess(): Promise<OwnerAdminAccessCheck> {
  const access = await resolveAuthClinicAccess();
  if (!access.ok) {
    if (access.reason === "no_session") {
      return { allowed: false, response: jsonUnauthorized("Please sign in to continue.") };
    }
    return { allowed: false, response: jsonForbidden("You do not have access to this account.") };
  }
  if (access.membership.role === "front_desk") {
    return {
      allowed: false,
      response: jsonForbidden("Front desk users cannot manage AI knowledge."),
    };
  }
  return { allowed: true, access };
}

// GET /api/account/ai-knowledge
// Returns the Business profile website (the future website-scan source) and
// the merged knowledge entries for the caller's clinic only.
export async function GET(): Promise<NextResponse> {
  const result = await requireOwnerAdminAccess();
  if (!result.allowed) return result.response;
  const { access } = result;

  try {
    const entries = await listClinicAiKnowledgeEntries(access.clinic.id);
    return jsonOk({
      ok: true,
      website: access.clinic.website ?? "",
      entries,
    });
  } catch {
    return jsonError(500, "load_failed", "We couldn't load AI knowledge. Please try again.");
  }
}

// POST /api/account/ai-knowledge
// Updates one entry. The question key must exist in the committed catalog;
// category/question always come from the server catalog, never the client.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await requireOwnerAdminAccess();
  if (!result.allowed) return result.response;
  const { access } = result;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const validated = validateAiKnowledgeUpdate({
    questionKey: input.questionKey,
    status: input.status,
    answer: input.answer,
    sourceType: input.sourceType,
  });
  if (!validated.ok) {
    return jsonBadRequest(validated.message);
  }

  try {
    const entry = await upsertClinicAiKnowledgeEntry({
      clinicId: access.clinic.id,
      update: validated.update,
      reviewedByProfileId: access.userId,
    });
    return jsonOk({ ok: true, entry });
  } catch {
    return jsonError(500, "save_failed", "We couldn't save this answer. Please try again.");
  }
}
