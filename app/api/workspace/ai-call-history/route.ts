import { NextResponse, type NextRequest } from "next/server";

import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../lib/http/responses";
import { resolveAuthClinicAccess } from "../../../../lib/auth/access";
import { findClinicConversationPhone } from "../../../../lib/db/front-desk";
import {
  AI_VOICE_SESSION_HISTORY_LIMIT,
  listAiVoiceSessionHistoryForConversation,
} from "../../../../lib/db/ai-voice-sessions";
import { toWorkspaceAiVoiceHistoryItem } from "../../../../lib/workspace/ai-voice-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// GET /api/workspace/ai-call-history?conversationId=...
//
// Bounded selected-card AI answered call history. The response is front-desk
// safe: no provider identifiers, raw payloads, audio, secrets, or model details.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess(req);
  if (!access.ok) {
    if (access.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You do not have access to this workspace.");
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId")?.trim() ?? "";
  if (!conversationId || conversationId.startsWith("sample-")) {
    return jsonBadRequest("Choose a patient request.");
  }
  if (!UUID_RE.test(conversationId)) {
    return jsonError(404, "not_found", "This request was not found.");
  }

  try {
    const conversation = await findClinicConversationPhone(access.clinic.id, conversationId);
    if (!conversation) return jsonError(404, "not_found", "This request was not found.");

    const rows = await listAiVoiceSessionHistoryForConversation({
      clinicId: access.clinic.id,
      conversationId,
      limit: AI_VOICE_SESSION_HISTORY_LIMIT,
    });
    return jsonOk({
      ok: true,
      history: rows.map(toWorkspaceAiVoiceHistoryItem),
    });
  } catch {
    return jsonError(500, "history_failed", "We couldn't load the call history.");
  }
}
