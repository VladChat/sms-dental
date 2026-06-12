import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

// Static guard: every automated SMS send must go through one of the two fully
// guarded send modules. A Twilio Messages API call site anywhere else in app/ or
// lib/ would bypass the mode/readiness/opt-out/duplicate guards, so this test
// fails if one appears.
//   - lib/twilio/outbound-sms.ts — missed-call recovery SMS (sendRecoverySms).
//   - lib/twilio/conversation-auto-reply.ts — deterministic conversation
//     auto-replies (maybeSendConversationAutoReply); enforces its own mode,
//     exact-number readiness, clinic gate, opt-out, max-replies, enabled-slot,
//     prior-recovery, keyword and duplicate guards.

const REPO_ROOT = process.cwd();
const ALLOWED_SEND_FILES = new Set([
  path.join("lib", "twilio", "outbound-sms.ts"),
  path.join("lib", "twilio", "conversation-auto-reply.ts"),
]);

// Drop // and /* */ comment lines so doc references to a function name do not
// count as call sites.
function stripCommentLines(source: string): string {
  return source
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("*") &&
        !trimmed.startsWith("/*")
      );
    })
    .join("\n");
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

test("messages.create is called only from the guarded send modules", () => {
  const files = [
    ...listSourceFiles(path.join(REPO_ROOT, "app")),
    ...listSourceFiles(path.join(REPO_ROOT, "lib")),
  ];
  const offenders: string[] = [];
  for (const file of files) {
    const source = stripCommentLines(fs.readFileSync(file, "utf8"));
    if (/\bmessages\s*\.\s*create\s*\(/.test(source)) {
      const rel = path.relative(REPO_ROOT, file);
      if (!ALLOWED_SEND_FILES.has(rel)) offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Twilio messages.create() must only be called from a guarded send module ` +
      `(${[...ALLOWED_SEND_FILES].join(", ")}). Offenders: ${offenders.join(", ")}`,
  );
});

test("sendRecoverySms is invoked only from the voice status webhook", () => {
  const files = [
    ...listSourceFiles(path.join(REPO_ROOT, "app")),
    ...listSourceFiles(path.join(REPO_ROOT, "lib")),
  ];
  const allowedCallers = new Set([
    path.join("app", "api", "webhooks", "twilio", "voice", "status", "route.ts"),
    path.join("lib", "twilio", "outbound-sms.ts"),
  ]);
  const offenders: string[] = [];
  for (const file of files) {
    const source = stripCommentLines(fs.readFileSync(file, "utf8"));
    if (/\bsendRecoverySms\s*\(/.test(source)) {
      const rel = path.relative(REPO_ROOT, file);
      if (!allowedCallers.has(rel)) offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `sendRecoverySms() has an unexpected caller: ${offenders.join(", ")}`,
  );
});

test("recovery send path renders the initial SMS from saved conversation settings", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "lib", "twilio", "outbound-sms.ts"), "utf8");

  assert.ok(src.includes("getClinicConversationConfig(input.clinic.id)"));
  assert.ok(src.includes("buildRecoverySmsBodyFromConversationConfig(input.clinic.name, config)"));
  assert.ok(!src.includes("buildMissedCallRecoverySmsBody(input.clinic.name);") || src.includes("initial_template_fallback"));
});

test("recovery send path resets the auto-reply cycle only after recording the recovery message", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "lib", "twilio", "outbound-sms.ts"), "utf8");
  const importIdx = src.indexOf("resetConversationAutoReplyCycle");
  const recordIdx = src.indexOf("await recordOutboundMessage({");
  const recoveryKindIdx = src.indexOf('messageKind: "missed_call_recovery"', recordIdx);
  const recordedFlagIdx = src.indexOf("recoveryMessageRecorded = true", recoveryKindIdx);
  const resetIdx = src.indexOf("await resetConversationAutoReplyCycle(", recordedFlagIdx);

  assert.ok(importIdx >= 0, "send path imports resetConversationAutoReplyCycle");
  assert.ok(recordIdx >= 0, "send path records the outbound message");
  assert.ok(recoveryKindIdx > recordIdx, "recorded outbound is a missed_call_recovery");
  assert.ok(recordedFlagIdx > recoveryKindIdx, "record flag is set after missed_call_recovery record");
  assert.ok(resetIdx > recordedFlagIdx, "auto-reply cycle resets after the recovery record succeeds");
});

test("resetConversationAutoReplyCycle clears reply-cycle state and conditionally resets test names", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "lib", "db", "conversations.ts"), "utf8");
  const start = src.indexOf("export async function resetConversationAutoReplyCycle");
  const end = src.indexOf("export type ConversationAutoReplyState", start);
  const helper = src.slice(start, end);

  assert.ok(start >= 0, "reset helper exists");
  assert.ok(helper.includes("sms_auto_reply_count = 0"));
  assert.ok(helper.includes("sms_auto_reply_last_sent_at = null"));
  assert.ok(helper.includes("sms_thanks_courtesy_sent_at = null"));
  assert.ok(helper.includes("sms_safety_notice_sent_at = null"));
  assert.ok(helper.includes("patient_display_name = case"));
  assert.ok(helper.includes("when ${resetPatientDisplayName} then null"));
  assert.ok(helper.includes("else patient_display_name"));
});

test("new recovery cycle resets volume state but never clears an ACTIVE mute early", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "lib", "db", "conversations.ts"), "utf8");
  const start = src.indexOf("export async function resetConversationAutoReplyCycle");
  const end = src.indexOf("export type ConversationAutoReplyState", start);
  const helper = src.slice(start, end);

  // Count + high-volume flag reset only when no mute is active; an active
  // automation_muted_until is preserved verbatim (never re-enabled early).
  assert.ok(helper.includes("unanswered_after_automation_count = case"));
  assert.ok(helper.includes("high_volume_flagged_at = case"));
  assert.ok(helper.includes("automation_muted_until = case"));
  const activeMuteGuards = helper.match(
    /automation_muted_until is not null and automation_muted_until > now\(\)/g,
  );
  assert.ok((activeMuteGuards?.length ?? 0) >= 3, "every volume column checks the active mute");
  assert.ok(helper.includes("then unanswered_after_automation_count"));
  assert.ok(helper.includes("then high_volume_flagged_at"));
  assert.ok(helper.includes("then automation_muted_until"));
});

test("auto-reply path skips ALL automation while muted and counts unanswered inbound", () => {
  const src = stripCommentLines(
    fs.readFileSync(path.join(REPO_ROOT, "lib", "twilio", "conversation-auto-reply.ts"), "utf8"),
  );

  const stateIdx = src.indexOf("await getConversationAutoReplyState(");
  const muteIdx = src.indexOf("isAutomationMuted(state, new Date())");
  const thanksIdx = src.indexOf("evaluateThanksCourtesyDecision({");
  const followUpIdx = src.indexOf("evaluateAutoReplyDecision({");
  assert.ok(stateIdx >= 0 && muteIdx > stateIdx, "mute check runs after state load");
  assert.ok(muteIdx < thanksIdx, "mute check runs before the thanks courtesy path");
  assert.ok(muteIdx < followUpIdx, "mute check runs before the follow-up decision");
  assert.ok(src.includes('skipAutoReply(input, "automation_muted")'));

  // Unanswered counting: while muted, and when automation ended normally.
  assert.ok(src.includes("reasonCountsAsUnanswered(decision.reason)"));
  assert.ok(src.includes("await recordUnansweredInboundAfterAutomation("));

  const dbSrc = stripCommentLines(
    fs.readFileSync(path.join(REPO_ROOT, "lib", "db", "conversations.ts"), "utf8"),
  );
  const recordStart = dbSrc.indexOf("export async function recordUnansweredInboundAfterAutomation");
  assert.ok(recordStart >= 0, "unanswered counter helper exists");
  const record = dbSrc.slice(recordStart, recordStart + 2200);
  assert.ok(record.includes("unanswered_after_automation_count + 1"));
  assert.ok(record.includes("automation_muted_until is null or automation_muted_until <= now()"));
  assert.ok(record.includes("high_volume_flagged_at is null"));
});

test("thanks courtesy and safety prefix use admin special-reply overrides", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "lib", "twilio", "conversation-auto-reply.ts"), "utf8");
  assert.ok(src.includes("customBody: config.specialReplies?.thanks_courtesy?.body ?? null"));
  assert.ok(src.includes("specialReplyTextForKey(config.specialReplies, \"safety_notice\")"));
});

test("safety notice prefix is claimed atomically after the slot claim, never standalone", () => {
  const src = stripCommentLines(
    fs.readFileSync(path.join(REPO_ROOT, "lib", "twilio", "conversation-auto-reply.ts"), "utf8"),
  );

  const slotClaimIdx = src.indexOf("await claimAutoReplySequence(");
  const safetyClaimIdx = src.indexOf("await claimSafetyNotice(");
  assert.ok(slotClaimIdx >= 0, "slot claim exists");
  assert.ok(safetyClaimIdx > slotClaimIdx, "safety notice claim happens after the slot claim");
  assert.ok(src.includes("shouldAttemptSafetyNoticePrefix"));
  // The prefix stays an add-on to the normal follow-up body and uses the
  // admin-configurable special reply text (default fallback inside).
  assert.ok(src.includes("? prefixSafetyNotice(body, specialReplyTextForKey(config.specialReplies, \"safety_notice\"))"));
  assert.ok(src.includes(": body,"));
  assert.ok(src.includes("safety_notice: true"));

  const dbSrc = stripCommentLines(
    fs.readFileSync(path.join(REPO_ROOT, "lib", "db", "conversations.ts"), "utf8"),
  );
  const claimStart = dbSrc.indexOf("export async function claimSafetyNotice");
  assert.ok(claimStart >= 0, "claimSafetyNotice helper exists");
  const claim = dbSrc.slice(claimStart, claimStart + 600);
  assert.ok(claim.includes("sms_safety_notice_sent_at = now()"));
  assert.ok(claim.includes("and sms_safety_notice_sent_at is null"));
});

test("recovery send path resets patient name only for duplicate-bypass test callers", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "lib", "twilio", "outbound-sms.ts"), "utf8");

  assert.ok(src.includes("isDuplicateSuppressionBypassCaller"));
  assert.ok(src.includes("smsConfig.duplicateSuppressionBypassNumbers"));
  assert.ok(src.includes("resetPatientDisplayNameForTest"));
  assert.ok(src.includes("auto_reply_cycle_test_name_reset"));
});
