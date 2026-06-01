import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../lib/http/responses";
import { resolveAuthClinicAccess } from "../../../../lib/auth/access";
import { saveFrontDeskOutcome } from "../../../../lib/db/front-desk";
import { FRONT_DESK_NOTE_MAX, isFrontDeskOutcome } from "../../../../lib/workspace/outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const OutcomeBodySchema = z.object({
  conversationId: z.string().trim().min(1).max(100),
  outcome: z.string().trim(),
  // Hard cap to bound payload size; the precise 300 limit is enforced below.
  note: z.union([z.string(), z.null()]).optional(),
});

// POST /api/workspace/outcome
//
// Save a real patient request outcome. Any active clinic member (owner, admin,
// or front_desk) may record an outcome for a conversation that belongs to their
// clinic. Sample cards are never persisted — sample IDs are rejected.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess();
  if (!access.ok) {
    if (access.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You do not have access to this workspace.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }

  const parsed = OutcomeBodySchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest("Please choose an outcome.");

  const conversationId = parsed.data.conversationId;
  // Sample/demo cards must never reach the database.
  if (conversationId.startsWith("sample-")) {
    return jsonBadRequest("Sample requests cannot be saved.");
  }
  if (!UUID_RE.test(conversationId)) {
    return jsonError(404, "not_found", "This request was not found.");
  }

  const outcome = parsed.data.outcome;
  if (!isFrontDeskOutcome(outcome)) {
    return jsonBadRequest("Please choose a valid outcome.");
  }

  const trimmedNote = (parsed.data.note ?? "").trim();
  if (trimmedNote.length > FRONT_DESK_NOTE_MAX) {
    return jsonBadRequest("Note must be 300 characters or less.");
  }
  // Store an empty note as null, consistent with other optional text fields.
  const note = trimmedNote.length > 0 ? trimmedNote : null;

  let saved;
  try {
    saved = await saveFrontDeskOutcome({
      clinicId: access.clinic.id,
      conversationId,
      outcome,
      note,
    });
  } catch {
    return jsonError(500, "save_failed", "We couldn't save this outcome. Please try again.");
  }

  // No row updated → the conversation does not belong to this clinic (or does
  // not exist). Do not reveal which.
  if (!saved) {
    return jsonError(404, "not_found", "This request was not found.");
  }

  return jsonOk({
    ok: true,
    conversationId: saved.id,
    outcome: saved.outcome,
    note: saved.note ?? "",
    outcomeAt: saved.outcomeAt.toISOString(),
    status: saved.status,
  });
}
