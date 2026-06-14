import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  applyFlagsToStatus,
  derivePrimaryWorkspaceStatus,
  sortWorkspaceSectionCards,
  workspaceSectionForCard,
  WORKSPACE_STATUS_META,
  WORKSPACE_FLAG_META,
  type PatientRequestCard,
} from "../app/workspace/_components/workspace-types";

const REPO_ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const BASE_FLAGS = {
  safetyConcern: false,
  automationPaused: false,
  highVolume: false,
  blocked: false,
  archived: false,
  handled: false,
};

function card(input: Partial<PatientRequestCard> & Pick<PatientRequestCard, "id" | "lastActivityAt">): PatientRequestCard {
  return {
    callerPhone: "+15550101010",
    patientName: null,
    summaryHeadline: "Review conversation",
    summaryChips: [],
    latestMessage: null,
    latestMessageDirection: null,
    status: "needs_follow_up",
    baseStatus: "needs_follow_up",
    flags: BASE_FLAGS,
    sourceChannel: "sms",
    createdAt: "2026-06-01T00:00:00.000Z",
    timeline: [],
    ...input,
  };
}

// ------------------------------------------------------ status + filters

test("primary status precedence: Blocked > Handled > Archived > base", () => {
  const base = { blocked: false, archived: false, handled: false };
  assert.equal(applyFlagsToStatus({ ...base }, "needs_follow_up"), "needs_follow_up");
  assert.equal(applyFlagsToStatus({ ...base, handled: true }, "needs_follow_up"), "handled");
  assert.equal(
    applyFlagsToStatus({ ...base, handled: true, archived: true }, "needs_follow_up"),
    "handled",
  );
  assert.equal(
    applyFlagsToStatus({ blocked: true, archived: true, handled: true }, "booked"),
    "blocked",
  );

  assert.equal(
    derivePrimaryWorkspaceStatus({
      flags: { blocked: false, archived: false, handled: false },
      outcome: "appointment_booked",
      dbStatus: "open",
      timeline: [{ direction: "inbound" }],
    }),
    "booked",
  );
  assert.equal(
    derivePrimaryWorkspaceStatus({
      flags: { blocked: false, archived: false, handled: false },
      outcome: null,
      dbStatus: "open",
      timeline: [{ direction: "outbound" }],
    }),
    "waiting_for_patient",
  );
});

test("queue sections: blocked > handled > needs follow-up, with archived-only still visible", () => {
  assert.equal(
    workspaceSectionForCard({ blocked: false, archived: false, handled: false }),
    "needs_follow_up",
  );
  assert.equal(
    workspaceSectionForCard({ blocked: false, archived: false, handled: true }),
    "handled",
  );
  assert.equal(
    workspaceSectionForCard({ blocked: false, archived: true, handled: false }),
    "needs_follow_up",
  );
  assert.equal(
    workspaceSectionForCard({ blocked: false, archived: true, handled: true }),
    "handled",
  );
  assert.equal(
    workspaceSectionForCard({ blocked: true, archived: true, handled: true }),
    "blocked",
  );
  assert.equal(
    workspaceSectionForCard({ blocked: true, archived: false, handled: false }),
    "blocked",
  );
});

test("queue section sorting follows the product order rules", () => {
  assert.deepEqual(
    sortWorkspaceSectionCards("needs_follow_up", [
      card({ id: "newer", lastActivityAt: "2026-06-10T10:00:00.000Z" }),
      card({ id: "older", lastActivityAt: "2026-06-10T09:00:00.000Z" }),
    ]).map((c) => c.id),
    ["older", "newer"],
  );

  assert.deepEqual(
    sortWorkspaceSectionCards("handled", [
      card({
        id: "older-handled",
        lastActivityAt: "2026-06-12T10:00:00.000Z",
        workspaceHandledAt: "2026-06-11T10:00:00.000Z",
      }),
      card({
        id: "newer-handled",
        lastActivityAt: "2026-06-10T10:00:00.000Z",
        workspaceHandledAt: "2026-06-12T10:00:00.000Z",
      }),
    ]).map((c) => c.id),
    ["newer-handled", "older-handled"],
  );

  assert.deepEqual(
    sortWorkspaceSectionCards("handled", [
      card({
        id: "fallback-last-activity",
        lastActivityAt: "2026-06-11T10:00:00.000Z",
      }),
      card({
        id: "outcome-timestamp",
        lastActivityAt: "2026-06-01T10:00:00.000Z",
        frontDeskOutcomeAt: "2026-06-12T10:00:00.000Z",
      }),
    ]).map((c) => c.id),
    ["outcome-timestamp", "fallback-last-activity"],
  );

  assert.deepEqual(
    sortWorkspaceSectionCards("blocked", [
      card({
        id: "older-block",
        lastActivityAt: "2026-06-12T10:00:00.000Z",
        blockedAt: "2026-06-11T10:00:00.000Z",
      }),
      card({
        id: "fallback-newer",
        lastActivityAt: "2026-06-13T10:00:00.000Z",
      }),
    ]).map((c) => c.id),
    ["fallback-newer", "older-block"],
  );
});

test("status and flag meta cover the new vocabulary", () => {
  assert.equal(WORKSPACE_STATUS_META.handled.label, "Handled");
  assert.equal(WORKSPACE_STATUS_META.archived.label, "Archived");
  assert.equal(WORKSPACE_STATUS_META.blocked.label, "Blocked");
  assert.equal(WORKSPACE_STATUS_META.waiting_for_patient.label, "Needs follow-up");
  assert.equal(WORKSPACE_FLAG_META.safetyConcern.label, "Safety concern");
  assert.equal(WORKSPACE_FLAG_META.automationPaused.label, "Automation paused");
  assert.equal(WORKSPACE_FLAG_META.highVolume.label, "High volume");
});

// ----------------------------------------------------------- data layer

test("listClinicConversations selects workspace queue fields and the block join", () => {
  const src = read(path.join("lib", "db", "front-desk.ts"));
  for (const col of [
    "patient_display_name",
    "sms_safety_notice_sent_at",
    "automation_muted_until",
    "high_volume_flagged_at",
    "unanswered_after_automation_count",
    "workspace_archived_at",
    "workspace_handled_at",
  ]) {
    assert.ok(src.includes(col), `front-desk select includes ${col}`);
  }
  assert.ok(src.includes("left join public.clinic_blocked_patient_numbers b"));
  assert.ok(src.includes("b.clinic_id = c.clinic_id"));
  assert.ok(src.includes("b.phone_number = c.patient_phone"));
  assert.ok(src.includes("isBlocked: c.blocked_at !== null"));
  // No Twilio SIDs / raw payloads exposed to the workspace.
  assert.ok(!src.includes("twilio_message_sid"));
  assert.ok(!src.includes("raw_payload"));
});

test("workspace queue actions are clinic-scoped and reversible", () => {
  const src = read(path.join("lib", "db", "front-desk.ts"));
  for (const fn of [
    "export async function saveFrontDeskNote",
    "export async function archiveConversation",
    "export async function reopenConversation",
    "export async function markConversationHandled",
    "export async function findClinicConversationPhone",
  ]) {
    assert.ok(src.includes(fn), `front-desk exports ${fn}`);
  }
  // Every workspace write is scoped by clinic_id in the WHERE clause.
  const writes = src.split("update public.patient_conversations").slice(1);
  for (const write of writes) {
    assert.ok(write.includes("clinic_id = ${"), "conversation write is clinic-scoped");
  }
  // Archive is reversible — reopen clears the archive columns, deletes nothing.
  assert.ok(src.includes("workspace_archived_at = null"));
  assert.ok(!src.toLowerCase().includes("delete from public.messages"));
  assert.ok(!src.toLowerCase().includes("delete from public.patient_conversations"));

  // Reopen returns the request fully to Active: handled + outcome cleared and
  // the lifecycle status reset so no stale booked state shows.
  const reopenStart = src.indexOf("export async function reopenConversation");
  const reopenEnd = src.indexOf("export async function markConversationHandled");
  const reopen = src.slice(reopenStart, reopenEnd);
  assert.ok(reopen.includes("workspace_handled_at = null"));
  assert.ok(reopen.includes("front_desk_outcome = null"));
  assert.ok(reopen.includes("front_desk_outcome_at = null"));
  assert.ok(reopen.includes("status = 'open'"));

  // mark_handled records the appointment answer as the front-desk outcome.
  const handledStart = src.indexOf("export async function markConversationHandled");
  const handled = src.slice(handledStart, handledStart + 2000);
  assert.ok(handled.includes("appointmentBooked: boolean"));
  assert.ok(handled.includes('"appointment_booked"'));
  assert.ok(handled.includes('"no_appointment_booked"'));
  assert.ok(handled.includes("front_desk_outcome = ${outcome}"));

  // Staff-edited names persist through the clinic-scoped helper.
  assert.ok(src.includes("export async function saveWorkspacePatientName"));
  assert.ok(src.includes("patient_display_name = ${params.name}"));
});

test("patient number blocks are clinic-scoped and never touch Twilio numbers", () => {
  const src = read(path.join("lib", "db", "patient-blocks.ts"));
  assert.ok(src.includes("export async function isPatientNumberBlocked"));
  assert.ok(src.includes("export async function blockPatientNumberForClinic"));
  assert.ok(src.includes("export async function unblockPatientNumberForClinic"));
  // Every query filters by clinic_id AND phone_number (clinic A cannot block B).
  const clinicScoped = src.match(/clinic_id = \$\{/g);
  assert.ok((clinicScoped?.length ?? 0) >= 3, "all block queries are clinic-scoped");
  // No Twilio client usage and no phone-number lifecycle changes here, and
  // blocks never read/write the carrier opt-out table.
  assert.ok(!src.includes("getTwilioClient"));
  assert.ok(!src.includes("public.phone_numbers"));
  assert.ok(!src.includes("from public.opt_outs"));
  assert.ok(!src.includes("into public.opt_outs"));
});

// ----------------------------------------------------------- send paths

test("blocked patient number suppresses the initial recovery SMS", () => {
  const src = read(path.join("lib", "twilio", "outbound-sms.ts"));
  assert.ok(src.includes("isPatientNumberBlocked(input.clinic.id, input.patientPhone)"));
  assert.ok(src.includes('reason: "patient_number_blocked"'));
  // The block guard runs BEFORE the Twilio send call.
  const guardIdx = src.indexOf("patient_number_blocked");
  const sendIdx = src.indexOf("client.messages.create");
  assert.ok(guardIdx >= 0 && sendIdx > guardIdx, "block guard precedes the Twilio send");
});

test("blocked patient number suppresses follow-ups, thanks courtesy, and safety prefix", () => {
  const src = read(path.join("lib", "twilio", "conversation-auto-reply.ts"));
  assert.ok(src.includes("isPatientNumberBlocked(input.clinic.id, input.patientPhone)"));
  const blockIdx = src.indexOf('skipAutoReply(input, "patient_number_blocked")');
  const thanksIdx = src.indexOf("evaluateThanksCourtesyDecision({");
  const followUpIdx = src.indexOf("evaluateAutoReplyDecision({");
  assert.ok(blockIdx >= 0, "auto-reply path has the block skip");
  assert.ok(blockIdx < thanksIdx, "block skip precedes the thanks courtesy path");
  assert.ok(blockIdx < followUpIdx, "block skip precedes the follow-up decision");
});

test("message helper detects any prior recovery outbound for a clinic phone", () => {
  const src = read(path.join("lib", "db", "messages.ts"));
  const start = src.indexOf("export async function hasAnyRecoveryOutboundToClinicPhone");
  const end = src.indexOf("export async function hasPriorRecoveryOutbound", start);
  const helper = src.slice(start, end);
  assert.ok(helper.includes("clinic_id   = ${clinicId}"));
  assert.ok(helper.includes("to_number   = ${toNumber}"));
  assert.ok(helper.includes("direction   = 'outbound'"));
  assert.ok(helper.includes("message_kind is null or message_kind = 'missed_call_recovery'"));
  assert.ok(!helper.includes("created_at >="), "ever check has no date window");
  assert.ok(!helper.includes("conversation_auto_reply"), "auto-replies do not count");
});

test("incoming webhook records inbound, preserves keywords, and auto-blocks public inbound SMS", () => {
  const src = read(
    path.join("app", "api", "webhooks", "twilio", "messaging", "incoming", "route.ts"),
  );
  // Inbound messages are recorded before any automation decision, so blocked
  // numbers keep an audit trail; compliance keyword handling is untouched.
  const recordIdx = src.indexOf("recordInboundMessage({");
  const optOutIdx = src.indexOf('if (keyword === "stop")', recordIdx);
  const historyIdx = src.indexOf("hasAnyRecoveryOutboundToClinicPhone(clinic.id, from)", optOutIdx);
  const blockIdx = src.indexOf("blockPatientNumberForClinic({", historyIdx);
  const archiveIdx = src.indexOf("archiveConversation({", blockIdx);
  const classificationIdx = src.indexOf("const reply = classifyInboundReply(body)", historyIdx);
  const autoReplyIdx = src.indexOf("maybeSendConversationAutoReply({");
  assert.ok(recordIdx >= 0 && optOutIdx > recordIdx);
  assert.ok(historyIdx > optOutIdx, "recovery history check runs after keyword handling");
  assert.ok(blockIdx > historyIdx && archiveIdx > blockIdx);
  assert.ok(classificationIdx > archiveIdx && autoReplyIdx > classificationIdx);
  assert.ok(src.includes("upsertOptOut"));
  assert.ok(src.includes("clearOptOut"));
  assert.ok(src.includes("!keyword && inboundRecorded && !inboundIsDuplicate"));
  assert.ok(src.includes('reason: "inbound_without_recovery_history"'));
  assert.ok(src.includes("blockedByProfileId: null"));
  assert.ok(src.includes("blockedByEmail: null"));
  assert.ok(src.includes("actor: { profileId: null, email: null }"));
  assert.ok(src.includes('logger.info("twilio.sms.auto_blocked_no_recovery_history"'));
  assert.ok(src.includes("patientPhoneLast4"));
  const logStart = src.indexOf('logger.info("twilio.sms.auto_blocked_no_recovery_history"');
  const logEnd = src.indexOf("});", logStart);
  const logBlock = src.slice(logStart, logEnd);
  assert.ok(!logBlock.includes("body"), "auto-block logs do not include message body");
});

// -------------------------------------------------------------- UI layer

test("workspace detail header carries the call button and actions; phone shown once", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes("Call patient"));
  assert.ok(src.includes('href={`tel:${card.callerPhone}`}'));
  assert.ok(src.includes("Handled"));
  assert.ok(!src.includes("TOOLTIP_ARCHIVE"));
  assert.ok(src.includes("Block number"));
  assert.ok(src.includes("Reopen"));
  assert.ok(src.includes("Unblock number"));
  // Header title is name-or-Not-provided with the phone once beneath it; the
  // queue list shows the phone as secondary only when a name exists.
  assert.ok(src.includes("{card.patientName ?? NOT_PROVIDED}"));
  assert.ok(src.includes('const NOT_PROVIDED = "Not provided"'));
  assert.ok(src.includes("{card.patientName && <span"));
  assert.ok(!src.includes('"Unknown"'), "Unknown placeholder fully replaced");
});

test("left queue cards show only name or phone, optional phone, and last activity", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  const start = src.indexOf("function QueueCard");
  const end = src.indexOf("async function postConversationAction", start);
  const queueCard = src.slice(start, end);
  const render = queueCard.slice(queueCard.indexOf("return ("));

  assert.ok(render.includes("{card.patientName ?? card.callerPhone}"));
  assert.ok(render.includes("{card.patientName && <span"));
  assert.ok(render.includes("{card.callerPhone}"));
  assert.ok(render.includes("Last activity"));

  assert.ok(!render.includes("summaryHeadline"));
  assert.ok(!render.includes("latestMessage"));
  assert.ok(!render.includes("SummaryChips"));
  assert.ok(!render.includes("Patient:"));
  assert.ok(!render.includes("Office:"));
  assert.ok(!render.includes("Review conversation"));
});

test("handled cards show saved result badges only in the Handled section", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  const start = src.indexOf("function QueueCard");
  const end = src.indexOf("async function postConversationAction", start);
  const queueCard = src.slice(start, end);

  assert.ok(queueCard.includes('section === "handled" ? handledOutcomeBadge'));
  assert.ok(queueCard.includes("Appointment booked"));
  assert.ok(queueCard.includes("No appointment booked"));
  assert.ok(queueCard.includes('"badge-success"'));
  assert.ok(queueCard.includes('"badge-neutral"'));
  assert.ok(!queueCard.includes("recovered"));
});

test("request summary card shows one headline + signal chips, no empty rows", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes("Request summary"));
  assert.ok(src.includes("{card.summaryHeadline}"));
  assert.ok(src.includes("SummaryChips"));
  // Chips render nothing when no signal exists; no "None detected" clutter.
  assert.ok(src.includes("if (chips.length === 0) return null"));
  assert.ok(!src.includes("None detected"));
  assert.ok(!src.includes('label: "Pain/urgent"'));
  assert.ok(!src.includes('label: "Payment"'));
  assert.ok(!src.includes('label: "Insurance"'));
  // The old field table is gone.
  assert.ok(!src.includes("Preferred appointment time"));
  assert.ok(!src.includes("Payment / insurance"));
});

test("shared patient request mapper passes only non-redundant system chips to cards", () => {
  const src = read(path.join("lib", "workspace", "patient-request-card.ts"));
  assert.ok(src.includes('id: "automation_paused"'));
  assert.ok(src.includes('id: "high_volume"'));
  assert.ok(!src.includes("...summary.chips.map"));
});

test("workspace UI does not render duplicated primary status badges", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(!src.includes("function StatusBadge"));
  assert.ok(!src.includes("<StatusBadge"));
  assert.ok(!src.includes("WORKSPACE_STATUS_META"));
  assert.ok(!src.includes("Waiting for patient"));
  // The section header owns this status; cards do not render a repeated badge.
  assert.ok(!src.includes('{m.label}'));
  assert.ok(!src.includes('badge ${m.badge}'));
});

test("name is inline-editable and saved via save_name", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes("function NameEditor"));
  assert.ok(src.includes('"save_name"'));
  assert.ok(src.includes("Patient name (leave empty to clear)"));
  assert.ok(src.includes("setEditing(true)"));
  assert.ok(src.includes("savedName.length > 0 ? savedName : null"));
  // Sample cards never save.
  assert.ok(src.includes("if (isSample) return;"));
});

test("handled flow asks Was appointment booked? and saves on Yes/No", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes("Was appointment booked?"));
  assert.ok(src.includes('runAction("mark_handled", { appointmentBooked: true })'));
  assert.ok(src.includes('runAction("mark_handled", { appointmentBooked: false })'));
  // Saving closes the mini panel and stamps the local outcome + handled flag.
  assert.ok(src.includes("setAskingHandled(false)"));
  assert.ok(src.includes('extra?.appointmentBooked ? "appointment_booked" : "no_appointment_booked"'));
  // No note field inside the mini panel and no radio inputs.
  assert.ok(!src.includes('type="radio"'));
  // Reopen clears handled+archived and the stale outcome locally.
  assert.ok(src.includes("archived: false, handled: false"));
  assert.ok(src.includes("frontDeskOutcome: null"));
  assert.ok(src.includes("frontDeskOutcomeAt: null"));
});

test("action tooltips use the exact agreed strings", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes('"Call this phone number."'));
  assert.ok(
    src.includes('"Close this request and record whether an appointment was booked."'),
  );
  assert.ok(!src.includes("TOOLTIP_ARCHIVE"));
  assert.ok(!src.includes("Move this request out of Active"));
  assert.ok(
    src.includes(
      '"Block this phone number. Automated texts to this number will stop, but messages stay saved."',
    ),
  );
  assert.ok(src.includes('"Move this request back to Active."'));
  assert.ok(
    src.includes(
      '"Unblock this phone number. Automated texts may resume if normal sending rules allow."',
    ),
  );
  // The block tooltip/confirm copy never says patient/clinic/business/Twilio.
  const blockCopyStart = src.indexOf("const TOOLTIP_BLOCK");
  const blockCopyEnd = src.indexOf("const TOOLTIP_REOPEN");
  const blockCopy = src.slice(blockCopyStart, blockCopyEnd).toLowerCase();
  for (const word of ["patient", "clinic", "business", "twilio"]) {
    assert.ok(!blockCopy.includes(word), `block tooltip avoids "${word}"`);
  }
  // Danger action is visually separated from the normal actions.
  assert.ok(src.includes("ws-actions-divider"));
  assert.ok(src.includes("btn-danger"));
});

test("message history shows the last 2 messages with a full toggle", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes("card.timeline.slice(-2)"));
  assert.ok(src.includes("Message history"));
  assert.ok(src.includes("Show full message history"));
  assert.ok(src.includes("Hide message history"));
  assert.ok(src.includes("Showing the last 2 of {card.timeline.length} messages."));
  assert.ok(!src.includes("Activity & SMS audit trail"));
  assert.ok(!src.includes("Raw SMS is kept here only as secondary history."));
  assert.ok(!src.includes("audit entries"));
  assert.ok(src.includes('"Patient"'));
  assert.ok(src.includes('"Your office"'));
  // The old prominent block and the big outcome radio form are gone.
  assert.ok(!src.includes("Latest patient reply"));
  assert.ok(!src.includes("FRONT_DESK_OUTCOMES"));
  assert.ok(!src.includes('type="radio"'));
});

test("block number requires inline confirmation with short safe wording", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(
    src.includes(
      "Block this phone number? Automated texts to this number will stop, but messages stay saved.",
    ),
  );
  assert.ok(src.includes("confirmingBlock"));
  assert.ok(src.includes("Cancel"));
});

test("internal note saves independently without an outcome", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes("Internal note"));
  assert.ok(src.includes('"save_note"'));
  assert.ok(src.includes("Save note"));
  assert.ok(src.includes("FRONT_DESK_NOTE_MAX"));
  assert.ok(!src.includes("Please choose an outcome"));
});

test("three sectioned queue has default expansion, tones, counts, Load more, and no auto-expand", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  const css = read(path.join("app", "globals.css"));
  // Sections replace the old top filter buttons and the separate Active list.
  assert.ok(src.includes('{ id: "needs_follow_up", label: "Needs follow-up", tone: "warning" }'));
  assert.ok(src.includes('{ id: "handled", label: "Handled", tone: "success" }'));
  assert.ok(src.includes('{ id: "blocked", label: "Blocked", tone: "danger" }'));
  assert.ok(!src.includes('{ id: "archived"'));
  assert.ok(!src.includes('label: "Archived"'));
  assert.ok(!src.includes('aria-pressed={filter === f.id}'), "old filter pills removed");
  assert.ok(!src.includes("grouped.active"));
  // Needs follow-up starts expanded; lower sections start collapsed.
  const expandedStart = src.indexOf("const [expandedSections");
  const expandedEnd = src.indexOf("const grouped", expandedStart);
  const expanded = src.slice(expandedStart, expandedEnd);
  assert.ok(expanded.includes("needs_follow_up: true"));
  assert.ok(expanded.includes("handled: false"));
  assert.ok(!expanded.includes("archived"));
  assert.ok(expanded.includes("blocked: false"));
  assert.ok(src.includes("open={expandedSections[section.id]}"));
  assert.ok(src.includes("{section.label} ({sectionCards.length})"));
  assert.ok(css.includes(".ws-section.tone-warning"));
  assert.ok(css.includes(".ws-section.tone-success"));
  assert.ok(css.includes(".ws-section.tone-danger"));
  // Load more: every section pages by 6, client-side only.
  assert.ok(src.includes("const SECTION_PAGE_SIZE = 6"));
  assert.ok(src.includes("sectionCards.slice(0, limit)"));
  assert.ok(src.includes("[section.id]: limit + SECTION_PAGE_SIZE"));
  assert.ok(src.includes("Load more"));
  assert.ok(!src.includes("Load more ("));

  const patchStart = src.indexOf("function patchCard");
  const patchEnd = src.indexOf("return (", patchStart);
  const patchCard = src.slice(patchStart, patchEnd);
  assert.ok(!patchCard.includes("setExpandedSections"));
  assert.ok(!patchCard.includes("workspaceSectionForCard(nextFlags)"));
});

test("samples demonstrate the three section layout and never dominate a live workspace", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  // Samples collapse by default when real conversations exist.
  assert.ok(src.includes("useState(hasReal)"));
  assert.ok(src.includes('"sample-needs-follow-up"'));
  assert.ok(src.includes('"sample-handled"'));
  assert.ok(!src.includes('"sample-archived"'));
  assert.ok(src.includes('"sample-blocked"'));
  // Sample headlines use the compact summary format.
  assert.ok(src.includes('"Cleaning appointment · Tomorrow"'));
  assert.ok(src.includes('"Appointment request · Next week"'));
  assert.ok(src.includes('"Review conversation"'));
  assert.ok(!src.includes('"Pain/urgent"'));
  assert.ok(!src.includes('"Insurance", label'));
  // The handled sample records a booked appointment.
  assert.ok(src.includes('frontDeskOutcome: "appointment_booked"'));
});

// -------------------------------------------------------------- API layer

test("conversation-action route validates input and scopes by clinic", () => {
  const src = read(path.join("app", "api", "workspace", "conversation-action", "route.ts"));
  assert.ok(src.includes("resolveAuthClinicAccess"));
  assert.ok(src.includes('conversationId.startsWith("sample-")'));
  assert.ok(src.includes("UUID_RE.test(conversationId)"));
  assert.ok(src.includes("FRONT_DESK_NOTE_MAX"));
  for (const action of [
    '"save_note"',
    '"save_name"',
    '"archive"',
    '"reopen"',
    '"mark_handled"',
    '"block_number"',
    '"unblock_number"',
  ]) {
    assert.ok(src.includes(action), `route supports ${action}`);
  }
  // save_name validates through the conservative fail-closed name rules.
  assert.ok(src.includes("validateWorkspaceDisplayNameInput(parsed.data.name)"));
  assert.ok(src.includes("saveWorkspacePatientName"));
  // mark_handled requires the Was-appointment-booked boolean.
  assert.ok(src.includes('typeof parsed.data.appointmentBooked !== "boolean"'));
  assert.ok(src.includes("Please choose whether an appointment was booked."));
  // Cross-clinic conversations are indistinguishable from missing ones.
  assert.ok(src.includes('"This request was not found."'));
  assert.ok(src.includes("findClinicConversationPhone(clinicId, conversationId)"));
  // Backend archive compatibility remains, blocking archives internally, and
  // unblocking returns the request to a visible state without sending SMS.
  assert.ok(src.includes("blockPatientNumberForClinic"));
  assert.ok(src.includes("unblockPatientNumberForClinic"));
  const blockIdx = src.indexOf("blockPatientNumberForClinic({");
  const archiveAfterBlockIdx = src.indexOf("archiveConversation({ clinicId, conversationId, actor })", blockIdx);
  assert.ok(blockIdx >= 0 && archiveAfterBlockIdx > blockIdx, "block also archives");
  const unblockIdx = src.indexOf("await unblockPatientNumberForClinic");
  const reopenAfterUnblockIdx = src.indexOf("reopenConversation({ clinicId, conversationId })", unblockIdx);
  assert.ok(unblockIdx >= 0 && reopenAfterUnblockIdx > unblockIdx, "unblock also reopens");
  assert.ok(!src.includes("messages.create"));
});

test("legacy outcome route remains for compatibility", () => {
  const src = read(path.join("app", "api", "workspace", "outcome", "route.ts"));
  assert.ok(src.includes("saveFrontDeskOutcome"));
  assert.ok(src.includes("resolveAuthClinicAccess"));
});

// -------------------------------------------------------------- migration

test("workspace queue migration is additive, clinic-scoped, and non-destructive", () => {
  const sql = read(
    path.join("supabase", "migrations", "20260625000100_workspace_queue_and_patient_blocks.sql"),
  );
  assert.match(sql, /create table if not exists public\.clinic_blocked_patient_numbers/);
  assert.match(sql, /clinic_id uuid not null references public\.clinics\(id\) on delete cascade/);
  assert.match(sql, /unique \(clinic_id, phone_number\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /source_conversation_id uuid references public\.patient_conversations\(id\) on delete set null/);
  for (const col of [
    "workspace_archived_at timestamptz",
    "workspace_archived_by_profile_id uuid",
    "workspace_archived_by_email text",
    "workspace_handled_at timestamptz",
    "workspace_handled_by_profile_id uuid",
    "workspace_handled_by_email text",
  ]) {
    assert.ok(sql.includes(col), `migration adds ${col}`);
  }
  assert.equal(/\bdrop\s+table\b/i.test(sql), false);
  assert.equal(/\bdelete\s+from\b/i.test(sql), false);
  assert.equal(/create policy/i.test(sql), false);
});
