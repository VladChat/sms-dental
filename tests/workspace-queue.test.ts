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

test("queue filters: blocked wins over archived; handled stays active", () => {
  assert.equal(workspaceFilterForCard({ blocked: false, archived: false }), "active");
  assert.equal(workspaceFilterForCard({ blocked: false, archived: true }), "archived");
  assert.equal(workspaceFilterForCard({ blocked: true, archived: true }), "blocked");
  assert.equal(workspaceFilterForCard({ blocked: true, archived: false }), "blocked");
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
  assert.ok(src.includes("Mark handled"));
  assert.ok(src.includes("Archive"));
  assert.ok(src.includes("Block number"));
  assert.ok(src.includes("Reopen"));
  assert.ok(src.includes("Unblock number"));
  // Header title is name-or-Unknown with the phone once beneath it; the list
  // shows the phone as secondary only when a name exists.
  assert.ok(src.includes("{card.patientName ?? UNKNOWN}"));
  assert.ok(src.includes("{c.patientName && ("));
});

test("request details card always renders the full field set", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  for (const label of [
    '"Name"',
    '"Phone"',
    '"Request"',
    '"Preferred appointment time"',
    '"Safety concern"',
    '"Payment / insurance"',
    '"First seen"',
    '"Last activity"',
  ]) {
    assert.ok(src.includes(`label=${label}`), `request details row ${label}`);
  }
  assert.ok(src.includes("card.requestType ?? UNKNOWN"));
  assert.ok(src.includes("card.safetyConcern ?? NONE_DETECTED"));
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

test("block number requires inline confirmation with the agreed wording", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(
    src.includes(
      "Block this patient number for this clinic? Automated replies will stop for this number. Messages will be kept.",
    ),
  );
  assert.ok(src.includes("confirmingBlock"));
  assert.ok(src.includes("does not change or"));
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

test("queue filters exist and samples no longer dominate a live workspace", () => {
  const src = read(path.join("app", "workspace", "_components", "Workspace.tsx"));
  assert.ok(src.includes('{ id: "active", label: "Active" }'));
  assert.ok(src.includes('{ id: "archived", label: "Archived" }'));
  assert.ok(src.includes('{ id: "blocked", label: "Blocked" }'));
  // Samples collapse by default when real conversations exist.
  assert.ok(src.includes("useState(hasReal)"));
  // Sample set demonstrates appointment, safety, insurance, and handled cards.
  assert.ok(src.includes('"sample-appointment"'));
  assert.ok(src.includes('"sample-safety"'));
  assert.ok(src.includes('"sample-insurance"'));
  assert.ok(src.includes('"sample-handled"'));
  assert.ok(src.includes("Mentioned pain/urgent concern"));
  assert.ok(src.includes("Insurance mentioned"));
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
    '"archive"',
    '"reopen"',
    '"mark_handled"',
    '"block_number"',
    '"unblock_number"',
  ]) {
    assert.ok(src.includes(action), `route supports ${action}`);
  }
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
