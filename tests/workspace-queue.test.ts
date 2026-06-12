import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  applyFlagsToStatus,
  derivePrimaryWorkspaceStatus,
  workspaceFilterForCard,
  WORKSPACE_STATUS_META,
  WORKSPACE_FLAG_META,
} from "../app/workspace/_components/workspace-types";

const REPO_ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

// ------------------------------------------------------ status + filters

test("primary status precedence: Blocked > Archived > Handled > base", () => {
  const base = { blocked: false, archived: false, handled: false };
  assert.equal(applyFlagsToStatus({ ...base }, "needs_follow_up"), "needs_follow_up");
  assert.equal(applyFlagsToStatus({ ...base, handled: true }, "needs_follow_up"), "handled");
  assert.equal(
    applyFlagsToStatus({ ...base, handled: true, archived: true }, "needs_follow_up"),
    "archived",
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

test("queue sections: blocked > archived > handled > active; handled leaves Active", () => {
  assert.equal(
    workspaceFilterForCard({ blocked: false, archived: false, handled: false }),
    "active",
  );
  assert.equal(
    workspaceFilterForCard({ blocked: false, archived: false, handled: true }),
    "handled",
  );
  assert.equal(
    workspaceFilterForCard({ blocked: false, archived: true, handled: false }),
    "archived",
  );
  assert.equal(
    workspaceFilterForCard({ blocked: false, archived: true, handled: true }),
    "archived",
  );
  assert.equal(
    workspaceFilterForCard({ blocked: true, archived: true, handled: true }),
    "blocked",
  );
  assert.equal(
    workspaceFilterForCard({ blocked: true, archived: false, handled: false }),
    "blocked",
  );
});

test("status and flag meta cover the new vocabulary", () => {
  assert.equal(WORKSPACE_STATUS_META.handled.label, "Handled");
  assert.equal(WORKSPACE_STATUS_META.archived.label, "Archived");
  assert.equal(WORKSPACE_STATUS_META.blocked.label, "Blocked");
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

test("incoming webhook still records inbound and keeps STOP/START/HELP first", () => {
  const src = read(
    path.join("app", "api", "webhooks", "twilio", "messaging", "incoming", "route.ts"),
  );
  // Inbound messages are recorded before any automation decision, so blocked
  // numbers keep an audit trail; compliance keyword handling is untouched.
  const recordIdx = src.indexOf("recordInboundMessage({");
  const optOutIdx = src.indexOf('if (keyword === "stop")', recordIdx);
  const autoReplyIdx = src.indexOf("maybeSendConversationAutoReply({");
  assert.ok(recordIdx >= 0 && optOutIdx > recordIdx && autoReplyIdx > optOutIdx);
  assert.ok(src.includes("upsertOptOut"));
  assert.ok(src.includes("clearOptOut"));
  assert.ok(!src.includes("patient_number_blocked"), "webhook itself does not gate recording");
});

// -------------------------------------------------------------- UI layer

test("workspace detail header carries the call button and actions; phone shown once", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes("Call patient"));
  assert.ok(src.includes('href={`tel:${card.callerPhone}`}'));
  assert.ok(src.includes("Handled"));
  assert.ok(src.includes("Archive"));
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

test("request summary card shows one headline + signal chips, no empty rows", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes("Request summary"));
  assert.ok(src.includes("{card.summaryHeadline}"));
  assert.ok(src.includes("SummaryChips"));
  // Chips render nothing when no signal exists; no "None detected" clutter.
  assert.ok(src.includes("if (chips.length === 0) return null"));
  assert.ok(!src.includes("None detected"));
  // The old field table is gone.
  assert.ok(!src.includes("Preferred appointment time"));
  assert.ok(!src.includes("Payment / insurance"));
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
});

test("action tooltips use the exact agreed strings", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes('"Call this phone number."'));
  assert.ok(
    src.includes('"Close this request and record whether an appointment was booked."'),
  );
  assert.ok(
    src.includes(
      '"Move this request out of Active. Messages stay saved and it can be reopened later."',
    ),
  );
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

test("conversation preview shows the last 2 messages with a full toggle", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes("card.timeline.slice(-2)"));
  assert.ok(src.includes("Show full conversation"));
  assert.ok(src.includes("Hide full conversation"));
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

test("Active queue is first with collapsed toned sections below, counts, and Load more", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  // Sections replace the old top filter buttons.
  assert.ok(src.includes('{ id: "handled", label: "Handled", tone: "success" }'));
  assert.ok(src.includes('{ id: "archived", label: "Archived", tone: "info" }'));
  assert.ok(src.includes('{ id: "blocked", label: "Blocked", tone: "danger" }'));
  assert.ok(!src.includes('aria-pressed={filter === f.id}'), "old filter pills removed");
  // Collapsed by default (<details> without open) with a count in the summary.
  assert.ok(src.includes("<details key={section.id}"));
  assert.ok(!src.includes("<details open"));
  assert.ok(src.includes("{section.label} ({sectionCards.length})"));
  // Section quick actions: Reopen (handled/archived) and Unblock (blocked).
  const sectionRow = src.slice(src.indexOf("function SectionRow"), src.indexOf("async function postConversationAction"));
  assert.ok(sectionRow.includes('section === "blocked" ? "unblock_number" : "reopen"'));
  // Load more: Active pages by 25, sections by 10 — client-side only.
  assert.ok(src.includes("const ACTIVE_PAGE_SIZE = 25"));
  assert.ok(src.includes("const SECTION_PAGE_SIZE = 10"));
  assert.ok(src.includes("Load more"));
});

test("samples demonstrate the five new layouts and never dominate a live workspace", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  // Samples collapse by default when real conversations exist.
  assert.ok(src.includes("useState(hasReal)"));
  assert.ok(src.includes('"sample-appointment"'));
  assert.ok(src.includes('"sample-no-name"'));
  assert.ok(src.includes('"sample-handled"'));
  assert.ok(src.includes('"sample-archived"'));
  assert.ok(src.includes('"sample-blocked"'));
  // Sample headlines use the compact summary format.
  assert.ok(src.includes('"Cleaning appointment · Tuesday morning"'));
  assert.ok(src.includes('"Mentions pain/urgent concern · Wants appointment"'));
  assert.ok(src.includes('"Review conversation"'));
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
  // Blocking archives the conversation; unblocking never sends SMS.
  assert.ok(src.includes("blockPatientNumberForClinic"));
  assert.ok(src.includes("unblockPatientNumberForClinic"));
  const blockIdx = src.indexOf("blockPatientNumberForClinic({");
  const archiveAfterBlockIdx = src.indexOf("archiveConversation({ clinicId, conversationId, actor })", blockIdx);
  assert.ok(blockIdx >= 0 && archiveAfterBlockIdx > blockIdx, "block also archives");
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
