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
import {
  archiveConversation,
  findClinicConversationPhone,
  markConversationHandled,
  reopenConversation,
  saveFrontDeskNote,
  saveWorkspacePatientName,
} from "../../../../lib/db/front-desk";
import {
  blockPatientNumberForClinic,
  unblockPatientNumberForClinic,
} from "../../../../lib/db/patient-blocks";
import { FRONT_DESK_NOTE_MAX } from "../../../../lib/workspace/outcome";
import { validateWorkspaceDisplayNameInput } from "../../../../lib/workspace/display-name";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const WORKSPACE_ACTIONS = [
  "save_note",
  "save_name",
  "archive",
  "reopen",
  "mark_handled",
  "block_number",
  "unblock_number",
] as const;
type WorkspaceAction = (typeof WORKSPACE_ACTIONS)[number];

const ActionBodySchema = z.object({
  conversationId: z.string().trim().min(1).max(100),
  action: z.string().trim(),
  // Hard caps to bound payload size; precise limits are enforced below.
  note: z.union([z.string(), z.null()]).optional(),
  name: z.union([z.string().max(200), z.null()]).optional(),
  appointmentBooked: z.boolean().optional(),
});

// POST /api/workspace/conversation-action
//
// Front-desk queue actions for ONE clinic-scoped conversation:
//   save_note      — saves the internal staff note only (no outcome required)
//   save_name      — saves/clears the staff-edited patient display name
//   archive        — hides from the active queue (reversible, deletes nothing)
//   reopen         — returns a handled/archived conversation to Active and
//                    clears the saved appointment outcome (no stale booked
//                    state after reopen)
//   mark_handled   — stamps handled AND records "Was appointment booked?"
//                    (required boolean -> appointment_booked / no_appointment_booked)
//   block_number   — blocks the PATIENT/CALLER number for this clinic and
//                    archives the conversation. Never touches the clinic's
//                    Twilio business number, never deletes history, and is
//                    separate from carrier opt-outs. Future automation to this
//                    number is suppressed; inbound messages stay recorded.
//   unblock_number — removes the clinic-scoped patient-number block and returns
//                    the conversation to Needs follow-up. Sends nothing.
//
// Any active clinic member (owner, admin, front_desk) may act on conversations
// that belong to their clinic only. Sample cards are rejected, and a missing/
// cross-clinic conversation is reported as not found (never which one).
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

  const parsed = ActionBodySchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest("Invalid request");

  const conversationId = parsed.data.conversationId;
  // Sample/demo cards must never reach the database.
  if (conversationId.startsWith("sample-")) {
    return jsonBadRequest("Sample requests cannot be changed.");
  }
  if (!UUID_RE.test(conversationId)) {
    return jsonError(404, "not_found", "This request was not found.");
  }

  const action = parsed.data.action as WorkspaceAction;
  if (!(WORKSPACE_ACTIONS as readonly string[]).includes(action)) {
    return jsonBadRequest("Invalid action.");
  }

  const clinicId = access.clinic.id;
  const actor = { profileId: access.userId, email: access.userEmail };

  try {
    if (action === "save_note") {
      const trimmedNote = (parsed.data.note ?? "").trim();
      if (trimmedNote.length > FRONT_DESK_NOTE_MAX) {
        return jsonBadRequest("Note must be 300 characters or less.");
      }
      const saved = await saveFrontDeskNote({
        clinicId,
        conversationId,
        note: trimmedNote.length > 0 ? trimmedNote : null,
      });
      if (!saved) return jsonError(404, "not_found", "This request was not found.");
      return jsonOk({ ok: true, action, note: saved.note ?? "" });
    }

    // save_name: staff-edited patient display name. Empty clears the name
    // ("Not provided"); anything else must pass the conservative fail-closed
    // name rules (no digits/URLs/emails/phones/keywords/request words).
    if (action === "save_name") {
      const validated = validateWorkspaceDisplayNameInput(parsed.data.name);
      if (!validated.ok) return jsonBadRequest(validated.message);
      const saved = await saveWorkspacePatientName({
        clinicId,
        conversationId,
        name: validated.value,
      });
      if (!saved) return jsonError(404, "not_found", "This request was not found.");
      return jsonOk({ ok: true, action, name: saved.name ?? "" });
    }

    if (action === "archive") {
      const archived = await archiveConversation({ clinicId, conversationId, actor });
      if (!archived) return jsonError(404, "not_found", "This request was not found.");
      return jsonOk({ ok: true, action, archivedAt: archived.archivedAt.toISOString() });
    }

    if (action === "reopen") {
      const reopened = await reopenConversation({ clinicId, conversationId });
      if (!reopened) return jsonError(404, "not_found", "This request was not found.");
      return jsonOk({ ok: true, action });
    }

    // mark_handled requires the appointment answer (Was appointment booked?)
    // and records it as the front-desk outcome alongside the handled stamp.
    if (action === "mark_handled") {
      if (typeof parsed.data.appointmentBooked !== "boolean") {
        return jsonBadRequest("Please choose whether an appointment was booked.");
      }
      const handled = await markConversationHandled({
        clinicId,
        conversationId,
        appointmentBooked: parsed.data.appointmentBooked,
        actor,
      });
      if (!handled) return jsonError(404, "not_found", "This request was not found.");
      return jsonOk({
        ok: true,
        action,
        handledAt: handled.handledAt.toISOString(),
        outcome: handled.outcome,
      });
    }

    // block_number / unblock_number need the conversation's patient phone,
    // resolved clinic-scoped so cross-clinic IDs are indistinguishable from
    // missing ones.
    const conversation = await findClinicConversationPhone(clinicId, conversationId);
    if (!conversation) return jsonError(404, "not_found", "This request was not found.");

    if (action === "block_number") {
      const blocked = await blockPatientNumberForClinic({
        clinicId,
        phoneNumber: conversation.patientPhone,
        blockedByProfileId: actor.profileId,
        blockedByEmail: actor.email,
        reason: "workspace_block",
        sourceConversationId: conversationId,
      });
      // Blocking also archives so the conversation leaves the active queue.
      await archiveConversation({ clinicId, conversationId, actor });
      return jsonOk({ ok: true, action, blockedAt: blocked.blockedAt.toISOString() });
    }

    // unblock_number: clears the block and removes any archived/handled trap so
    // the request is immediately visible again. No SMS is sent.
    await unblockPatientNumberForClinic(clinicId, conversation.patientPhone);
    await reopenConversation({ clinicId, conversationId });
    return jsonOk({ ok: true, action });
  } catch {
    return jsonError(500, "action_failed", "We couldn't complete this action. Please try again.");
  }
}
