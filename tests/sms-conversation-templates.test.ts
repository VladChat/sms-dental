import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import { smsRecoveryConfig } from "../config/sms-recovery.config";
import { buildMissedCallRecoverySmsBody } from "../lib/sms-recovery/templates";
import {
  AUTO_REPLY_SLOTS,
  DEFAULT_FOLLOW_UP_TEMPLATES,
  DEFAULT_INITIAL_TEMPLATE,
  MAX_AUTO_REPLIES,
  buildInitialSmsBody,
  defaultFollowUpTemplateForSlot,
  effectiveFollowUpTemplate,
  effectiveInitialTemplate,
  enabledFollowUpSequences,
  followUpBodyForSlot,
  hasDefaultFollowUpTemplate,
  renderConversationTemplate,
  type FollowUpSlot,
} from "../lib/sms-recovery/conversation-templates";
import { prepareConversationTemplateStorage } from "../lib/db/sms-conversation-settings";
import { buildRecoverySmsBodyFromConversationConfig } from "../lib/sms-recovery/send-body";
import {
  validateFollowUpBody,
  validateInitialTemplate,
  validateSafetyNoticeText,
  validateThanksReplyText,
  validateVoiceGreetingTemplate,
} from "../lib/sms-recovery/template-safety";
import {
  DEFAULT_SPECIAL_REPLY_TEMPLATES,
  specialReplyTextForKey,
} from "../lib/sms-recovery/special-reply-templates";
import {
  SAFETY_NOTICE_PREFIX,
  THANKS_COURTESY_REPLY_BODY,
} from "../lib/sms-recovery/auto-reply-evaluation";
import {
  DEFAULT_VOICE_GREETING_TEMPLATES,
  renderVoiceGreetingTemplate,
} from "../lib/sms-recovery/voice-greeting-templates";

const CLINIC = "Fairstone Dental Smile";

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function followUpConfig(
  overrides: Partial<Record<FollowUpSlot, { body: string | null; enabled: boolean }>> = {},
): Record<FollowUpSlot, { body: string | null; enabled: boolean }> {
  return Object.fromEntries(
    AUTO_REPLY_SLOTS.map((slot) => [
      slot,
      overrides[slot] ?? { body: null, enabled: false },
    ]),
  ) as Record<FollowUpSlot, { body: string | null; enabled: boolean }>;
}

// ----------------------------------------------------------- initial SMS body

test("default initial message equals the current production message exactly", () => {
  const expected =
    "Hi, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.";
  assert.equal(buildInitialSmsBody(CLINIC, null), expected);
  assert.equal(buildInitialSmsBody(CLINIC, ""), expected);
  assert.equal(buildInitialSmsBody(CLINIC, "   "), expected);
  assert.equal(buildInitialSmsBody(CLINIC, null), buildMissedCallRecoverySmsBody(CLINIC));
  assert.equal(DEFAULT_INITIAL_TEMPLATE, smsRecoveryConfig.missedCallTemplate);
});

test("platform admin full initial template renders directly", () => {
  const template =
    "Hello, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out.";
  const body = buildInitialSmsBody(CLINIC, template);
  assert.equal(
    body,
    "Hello, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.",
  );
  assert.equal(count(body, CLINIC), 1);
  assert.equal(count(body, "Reply STOP to opt out"), 1);
});

test("custom initial template must remain a full safe template", () => {
  assert.throws(
    () => buildInitialSmsBody(CLINIC, "Sorry we missed you. How can we help?"),
    /missing clinic identity/,
  );
});

test("saved full initial text no longer duplicates clinic identity or STOP", () => {
  const fullTemplate =
    "Hi, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out.";
  const body = buildInitialSmsBody(CLINIC, fullTemplate);
  assert.equal(
    body,
    "Hi, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.",
  );
  assert.equal(count(body, CLINIC), 1);
  assert.equal(count(body, "Reply STOP to opt out"), 1);
});

test("real recovery SMS send body helper uses the saved initial template", () => {
  const fullTemplate =
    "Hello, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out.";
  const body = buildRecoverySmsBodyFromConversationConfig(CLINIC, {
    initialTemplate: fullTemplate,
  });
  assert.equal(
    body,
    "Hello, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.",
  );
});

test("duplicated initial template text is normalized before final render", () => {
  const duplicated =
    "Hi, this is {{clinic_name}}. Hi, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out. Reply STOP to opt out.";
  const body = buildInitialSmsBody(CLINIC, duplicated);
  assert.equal(
    body,
    "Hi, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.",
  );
  assert.equal(count(body, CLINIC), 1);
  assert.equal(count(body, "Reply STOP to opt out"), 1);
});

test("literal clinic identity rows fail closed after a clinic rename", () => {
  const savedWithOldName =
    "Hello, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.";
  assert.throws(
    () => buildInitialSmsBody("Renamed Dental Office", savedWithOldName),
    /missing clinic identity/,
  );
});

test("default-backed templates expose effective code defaults", () => {
  assert.equal(effectiveInitialTemplate(null), DEFAULT_INITIAL_TEMPLATE);
  assert.equal(effectiveFollowUpTemplate(1, null), DEFAULT_FOLLOW_UP_TEMPLATES[1]);
  assert.equal(effectiveFollowUpTemplate(2, "Custom text"), "Custom text");
  assert.equal(effectiveFollowUpTemplate(4, null), "");
  assert.equal(defaultFollowUpTemplateForSlot(4), null);
  assert.equal(hasDefaultFollowUpTemplate(3), true);
  assert.equal(hasDefaultFollowUpTemplate(4), false);
});

test("initial full-template validation preserves identity and STOP requirements", () => {
  assert.equal(validateInitialTemplate("x".repeat(241), CLINIC).ok, false);
  assert.equal(validateInitialTemplate("Limited time discount!", CLINIC).ok, false);
  assert.equal(validateInitialTemplate("Call us at 224-532-9236", CLINIC).ok, false);
  assert.equal(validateInitialTemplate("Visit https://example.com", CLINIC).ok, false);
  assert.equal(validateInitialTemplate("Hi {{patient_name}}", CLINIC).ok, false);

  assert.equal(
    validateInitialTemplate(
      "We missed your call. How can we help? Reply STOP to opt out.",
      CLINIC,
    ).ok,
    false,
  );
  assert.equal(
    validateInitialTemplate(
      "Hi, this is {{clinic_name}}. We missed your call. How can we help?",
      CLINIC,
    ).ok,
    false,
  );
  assert.ok(validateInitialTemplate(DEFAULT_INITIAL_TEMPLATE, CLINIC).ok);
  assert.ok(
    validateInitialTemplate(
      "Hello, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.",
      CLINIC,
    ).ok,
  );
  assert.ok(validateInitialTemplate("", CLINIC).ok);
});

test("canonical default copy is current", () => {
  assert.equal(
    DEFAULT_INITIAL_TEMPLATE,
    "Hi, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out.",
  );
  assert.equal(
    DEFAULT_FOLLOW_UP_TEMPLATES[1],
    "Thanks for the info. What name should we use when our office follows up? If you're looking for an appointment, what time works best for you?",
  );
  assert.equal(
    DEFAULT_FOLLOW_UP_TEMPLATES[2],
    "Thanks, {{patient_name}}. I'll pass this to our team so they can follow up.",
  );
  assert.equal(
    DEFAULT_FOLLOW_UP_TEMPLATES[3],
    "Got it. We'll pass that along to our team.",
  );
  assert.equal(MAX_AUTO_REPLIES, 10);
  assert.deepEqual(AUTO_REPLY_SLOTS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(defaultFollowUpTemplateForSlot(4), null);
});

test("default SMS and voice copy uses ASCII punctuation only", () => {
  const defaults = [
    DEFAULT_INITIAL_TEMPLATE,
    DEFAULT_FOLLOW_UP_TEMPLATES[1],
    DEFAULT_FOLLOW_UP_TEMPLATES[2],
    DEFAULT_FOLLOW_UP_TEMPLATES[3],
    DEFAULT_VOICE_GREETING_TEMPLATES.will_send,
    DEFAULT_VOICE_GREETING_TEMPLATES.duplicate,
    DEFAULT_VOICE_GREETING_TEMPLATES.none,
  ];

  for (const text of defaults) {
    assert.equal(/[’“”]/.test(text), false, `non-ASCII punctuation in: ${text}`);
  }
});

test("missing clinic name falls back to a neutral identity, never broken text", () => {
  const body = buildInitialSmsBody("", null);
  assert.ok(body.startsWith("Hi, this is your dental office."));
  assert.ok(!body.includes("{{"));
});

// ---------------------------------------------------------- follow-up render

test("{{clinic_name}} and {{patient_name}} render when present", () => {
  const out = renderConversationTemplate("Thanks, {{patient_name}}. — {{clinic_name}}", {
    clinicName: CLINIC,
    patientName: "John",
  });
  assert.equal(out, "Thanks, John. — Fairstone Dental Smile");
});

test("missing patient name produces natural text, not broken placeholders", () => {
  const out = renderConversationTemplate(DEFAULT_FOLLOW_UP_TEMPLATES[2], {
    clinicName: CLINIC,
    patientName: null,
  });
  assert.equal(out, "Thanks. I'll pass this to our team so they can follow up.");
  assert.ok(!out.includes("{{"));
  assert.ok(!out.includes(",  "));
});

test("unknown placeholders are rejected in follow-up validation", () => {
  assert.equal(validateFollowUpBody("Hi {{first_name}}").ok, false);
  assert.equal(validateFollowUpBody("We can book you tomorrow").ok, false);
  assert.equal(validateFollowUpBody("Email us at a@b.com").ok, false);
  assert.ok(validateFollowUpBody("Thanks, {{patient_name}}. We'll follow up.").ok);
  assert.ok(validateFollowUpBody("").ok);
});

test("enabled follow-up with null body uses the current code default", () => {
  const config = {
    initialTemplate: null,
    maxAutoReplies: 3,
    followUps: followUpConfig({
      1: { body: null, enabled: true },
      2: { body: "Custom second reply.", enabled: true },
      3: { body: null, enabled: false },
    }),
    voiceGreetings: {
      will_send: { body: null },
      duplicate: { body: null },
      none: { body: null },
    },
  };

  assert.deepEqual(enabledFollowUpSequences(config), [1, 2]);
  assert.equal(followUpBodyForSlot(config, 1), DEFAULT_FOLLOW_UP_TEMPLATES[1]);
  assert.equal(followUpBodyForSlot(config, 2), "Custom second reply.");
});

test("additional follow-up slots have no default and require custom text to be usable", () => {
  const config = {
    initialTemplate: null,
    maxAutoReplies: 10,
    followUps: followUpConfig({
      1: { body: null, enabled: true },
      2: { body: null, enabled: true },
      3: { body: null, enabled: true },
      4: { body: null, enabled: true },
      5: { body: "Custom fifth reply.", enabled: true },
      10: { body: "Custom tenth reply.", enabled: true },
    }),
    voiceGreetings: {
      will_send: { body: null },
      duplicate: { body: null },
      none: { body: null },
    },
  };

  assert.deepEqual(enabledFollowUpSequences(config), [1, 2, 3, 5, 10]);
  assert.equal(followUpBodyForSlot(config, 4), null);
  assert.equal(followUpBodyForSlot(config, 5), "Custom fifth reply.");
  assert.equal(effectiveFollowUpTemplate(10, null), "");
});

test("saving default text prepares null/delete storage instead of literal defaults", () => {
  const prepared = prepareConversationTemplateStorage({
    initialTemplate: DEFAULT_INITIAL_TEMPLATE,
    maxAutoReplies: 2,
    followUps: followUpConfig({
      1: { body: DEFAULT_FOLLOW_UP_TEMPLATES[1], enabled: true },
      2: { body: "Custom second reply.", enabled: true },
      3: { body: DEFAULT_FOLLOW_UP_TEMPLATES[3], enabled: false },
    }),
    voiceGreetings: {
      will_send: { body: DEFAULT_VOICE_GREETING_TEMPLATES.will_send },
      duplicate: { body: DEFAULT_VOICE_GREETING_TEMPLATES.duplicate },
      none: { body: DEFAULT_VOICE_GREETING_TEMPLATES.none },
    },
  });

  assert.equal(prepared.keepSettingsRow, true);
  assert.equal(prepared.maxAutoReplies, 2);
  assert.deepEqual(
    prepared.upsertRows.filter((row) => row.role === "auto_reply"),
    [
      { role: "auto_reply", sequence: 1, body: null, enabled: true },
      { role: "auto_reply", sequence: 2, body: "Custom second reply.", enabled: true },
    ],
  );
  assert.ok(prepared.deleteRows.some((row) => row.role === "initial" && row.sequence === 0));
  assert.ok(prepared.deleteRows.some((row) => row.role === "auto_reply" && row.sequence === 3));
  assert.equal(prepared.upsertRows.some((row) => row.body === DEFAULT_INITIAL_TEMPLATE), false);
  assert.equal(prepared.upsertRows.some((row) => row.body === DEFAULT_FOLLOW_UP_TEMPLATES[1]), false);
});

test("disabled custom follow-up draft is preserved, disabled default follow-up is deleted", () => {
  const prepared = prepareConversationTemplateStorage({
    initialTemplate: null,
    maxAutoReplies: 0,
    followUps: followUpConfig({
      1: { body: "Custom draft reply.", enabled: false },
      2: { body: DEFAULT_FOLLOW_UP_TEMPLATES[2], enabled: false },
      3: { body: null, enabled: false },
    }),
    voiceGreetings: {
      will_send: { body: null },
      duplicate: { body: null },
      none: { body: null },
    },
  });

  assert.equal(prepared.keepSettingsRow, false);
  assert.ok(
    prepared.upsertRows.some(
      (row) =>
        row.role === "auto_reply" &&
        row.sequence === 1 &&
        row.body === "Custom draft reply." &&
        row.enabled === false,
    ),
  );
  assert.ok(prepared.deleteRows.some((row) => row.role === "auto_reply" && row.sequence === 2));
  assert.ok(prepared.deleteRows.some((row) => row.role === "auto_reply" && row.sequence === 3));
});

test("saving additional empty follow-up slots fails closed while preserving custom drafts", () => {
  const prepared = prepareConversationTemplateStorage({
    initialTemplate: null,
    maxAutoReplies: 10,
    followUps: followUpConfig({
      4: { body: null, enabled: true },
      5: { body: "Custom fifth reply.", enabled: false },
      10: { body: "Custom tenth reply.", enabled: true },
    }),
    voiceGreetings: {
      will_send: { body: null },
      duplicate: { body: null },
      none: { body: null },
    },
  });

  assert.equal(prepared.maxAutoReplies, 10);
  assert.ok(prepared.deleteRows.some((row) => row.role === "auto_reply" && row.sequence === 4));
  assert.ok(
    prepared.upsertRows.some(
      (row) =>
        row.role === "auto_reply" &&
        row.sequence === 5 &&
        row.body === "Custom fifth reply." &&
        row.enabled === false,
    ),
  );
  assert.ok(
    prepared.upsertRows.some(
      (row) =>
        row.role === "auto_reply" &&
        row.sequence === 10 &&
        row.body === "Custom tenth reply." &&
        row.enabled === true,
    ),
  );
});

test("default-cleanup migration is data-only and preserves follow-up enabled rows", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20260621000100_clean_sms_template_default_overrides.sql"),
    "utf8",
  );

  assert.match(sql, /update public\.clinic_sms_message_templates\s+set body_text = null/i);
  assert.match(sql, /where template_role = 'auto_reply'/i);
  assert.match(sql, /delete from public\.clinic_sms_message_templates\s+where template_role = 'initial'/i);
  assert.match(sql, /delete from public\.clinic_sms_message_templates\s+where template_role = 'voice_greeting'/i);
  assert.equal(/\balter\s+table\b/i.test(sql), false);
  assert.equal(/\bcreate\s+table\b/i.test(sql), false);
  assert.ok(sql.includes("Thanks. What name should we use when our office follows up?"));
  assert.ok(sql.includes("Got it. We''ll include that note for the office."));
  assert.ok(sql.includes("We''ll send you a text now, so our team can follow up."));
});

test("follow-up expansion migration widens SMS slots and adds thanks courtesy state", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20260622000100_expand_sms_conversation_followups.sql"),
    "utf8",
  );

  assert.match(sql, /max_auto_replies\s+between\s+0\s+and\s+10/i);
  assert.match(sql, /template_role\s+=\s+'auto_reply'\s+and\s+sequence\s+between\s+1\s+and\s+10/i);
  assert.match(sql, /template_role\s+=\s+'voice_greeting'\s+and\s+sequence\s+between\s+1\s+and\s+3/i);
  assert.match(sql, /add column if not exists sms_thanks_courtesy_sent_at timestamptz/i);
});

test("safety notice migration adds the marker and cleans old follow-up #1 defaults", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20260623000100_sms_safety_notice.sql"),
    "utf8",
  );

  assert.match(sql, /add column if not exists sms_safety_notice_sent_at timestamptz/i);
  assert.match(sql, /update public\.clinic_sms_message_templates\s+set body_text = null/i);
  assert.match(sql, /where template_role = 'auto_reply'/i);
  assert.match(sql, /sequence = 1/);
  // Old default-like Follow-up #1 bodies are cleared so default-backed clinics
  // pick up the new code default; custom text rows are untouched.
  assert.ok(sql.includes("Thanks for the info. What name should we use when our office follows up?"));
  assert.ok(sql.includes("If you''re looking for an appointment, what time works best for you?"));
  assert.ok(sql.includes("body_text is not null"));
  assert.equal(/\bcreate\s+table\b/i.test(sql), false);
  assert.equal(/\bdelete\s+from\b/i.test(sql), false);
});

test("follow-up #1 default asks for name and preferred time; custom text is preserved", () => {
  assert.equal(effectiveFollowUpTemplate(1, null), DEFAULT_FOLLOW_UP_TEMPLATES[1]);
  assert.equal(effectiveFollowUpTemplate(1, "Custom first reply."), "Custom first reply.");
  assert.ok(validateFollowUpBody(DEFAULT_FOLLOW_UP_TEMPLATES[1]).ok);

  // Saving the new default stores NULL (default-backed), not a literal override.
  const prepared = prepareConversationTemplateStorage({
    initialTemplate: null,
    maxAutoReplies: 1,
    followUps: followUpConfig({
      1: { body: DEFAULT_FOLLOW_UP_TEMPLATES[1], enabled: true },
    }),
    voiceGreetings: {
      will_send: { body: null },
      duplicate: { body: null },
      none: { body: null },
    },
  });
  assert.deepEqual(
    prepared.upsertRows.filter((row) => row.role === "auto_reply"),
    [{ role: "auto_reply", sequence: 1, body: null, enabled: true }],
  );
});

// ------------------------------------------------------------ special replies

test("special reply code defaults stay the canonical safety/thanks texts", () => {
  assert.equal(
    DEFAULT_SPECIAL_REPLY_TEMPLATES.safety_notice,
    "If this is a medical emergency, call 911.",
  );
  assert.equal(
    DEFAULT_SPECIAL_REPLY_TEMPLATES.thanks_courtesy,
    "You're welcome. Our team will follow up.",
  );
  // The send-path constants are the same source of truth.
  assert.equal(SAFETY_NOTICE_PREFIX, DEFAULT_SPECIAL_REPLY_TEMPLATES.safety_notice);
  assert.equal(THANKS_COURTESY_REPLY_BODY, DEFAULT_SPECIAL_REPLY_TEMPLATES.thanks_courtesy);
});

test("special reply effective text uses custom override else code default", () => {
  assert.equal(
    specialReplyTextForKey(undefined, "safety_notice"),
    DEFAULT_SPECIAL_REPLY_TEMPLATES.safety_notice,
  );
  assert.equal(
    specialReplyTextForKey(
      { safety_notice: { body: null }, thanks_courtesy: { body: null } },
      "thanks_courtesy",
    ),
    DEFAULT_SPECIAL_REPLY_TEMPLATES.thanks_courtesy,
  );
  assert.equal(
    specialReplyTextForKey(
      {
        safety_notice: { body: "If this is a medical emergency, please call 911 now." },
        thanks_courtesy: { body: null },
      },
      "safety_notice",
    ),
    "If this is a medical emergency, please call 911 now.",
  );
});

test("special reply storage keeps custom overrides and removes default-equal text", () => {
  const prepared = prepareConversationTemplateStorage({
    initialTemplate: null,
    maxAutoReplies: 0,
    followUps: followUpConfig(),
    voiceGreetings: {
      will_send: { body: null },
      duplicate: { body: null },
      none: { body: null },
    },
    specialReplies: {
      safety_notice: { body: "If this is a medical emergency, please call 911 now." },
      thanks_courtesy: { body: DEFAULT_SPECIAL_REPLY_TEMPLATES.thanks_courtesy },
    },
  });

  assert.ok(
    prepared.upsertRows.some(
      (row) =>
        row.role === "special_reply" &&
        row.sequence === 1 &&
        row.body === "If this is a medical emergency, please call 911 now." &&
        row.enabled === true,
    ),
  );
  // Default-equal thanks text is a delete (NULL/no row = current default).
  assert.ok(prepared.deleteRows.some((row) => row.role === "special_reply" && row.sequence === 2));
  assert.equal(
    prepared.upsertRows.some((row) => row.body === DEFAULT_SPECIAL_REPLY_TEMPLATES.thanks_courtesy),
    false,
  );
});

test("anti-spam settings store NULL when default and keep the settings row when custom", () => {
  const allDefault = prepareConversationTemplateStorage({
    initialTemplate: null,
    maxAutoReplies: 0,
    followUps: followUpConfig(),
    voiceGreetings: { will_send: { body: null }, duplicate: { body: null }, none: { body: null } },
    antiSpam: { unansweredMuteAfter: 6, unansweredHighVolumeAfter: 10, automationMuteHours: 24 },
  });
  assert.deepEqual(allDefault.antiSpam, {
    unansweredMuteAfter: null,
    unansweredHighVolumeAfter: null,
    automationMuteHours: null,
  });
  assert.equal(allDefault.keepSettingsRow, false);

  const custom = prepareConversationTemplateStorage({
    initialTemplate: null,
    maxAutoReplies: 0,
    followUps: followUpConfig(),
    voiceGreetings: { will_send: { body: null }, duplicate: { body: null }, none: { body: null } },
    antiSpam: { unansweredMuteAfter: 3, unansweredHighVolumeAfter: 10, automationMuteHours: 48 },
  });
  assert.deepEqual(custom.antiSpam, {
    unansweredMuteAfter: 3,
    unansweredHighVolumeAfter: null,
    automationMuteHours: 48,
  });
  // Custom anti-spam must survive even with max_auto_replies = 0.
  assert.equal(custom.keepSettingsRow, true);
});

test("safety notice validation requires conditional 911 wording and stays safe", () => {
  assert.ok(validateSafetyNoticeText(DEFAULT_SPECIAL_REPLY_TEMPLATES.safety_notice).ok);
  assert.ok(validateSafetyNoticeText("If this is a medical emergency, please call 911 now.").ok);
  assert.ok(validateSafetyNoticeText("").ok); // empty = use default

  assert.equal(validateSafetyNoticeText("Call 911.").ok, false); // missing "medical emergency"
  assert.equal(validateSafetyNoticeText("If this is a medical emergency, seek care.").ok, false); // missing "call 911"
  assert.equal(
    validateSafetyNoticeText("You need treatment. If this is a medical emergency, call 911.").ok,
    false, // diagnosis/treatment language
  );
  assert.equal(
    validateSafetyNoticeText("This is urgent! If this is a medical emergency, call 911.").ok,
    false, // urgency marketing word
  );
  assert.equal(
    validateSafetyNoticeText("If this is a medical emergency, call 911 or 224-532-9236.").ok,
    false, // only 911 may appear
  );
  assert.equal(
    validateSafetyNoticeText("If this is a medical emergency, call 911. Visit https://example.com").ok,
    false,
  );
  assert.equal(
    validateSafetyNoticeText(`If this is a medical emergency, call 911. ${"x".repeat(160)}`).ok,
    false, // too long
  );
});

test("thanks reply validation rejects unsafe content and variables", () => {
  assert.ok(validateThanksReplyText(DEFAULT_SPECIAL_REPLY_TEMPLATES.thanks_courtesy).ok);
  assert.ok(validateThanksReplyText("Happy to help. Our office will reach out.").ok);
  assert.ok(validateThanksReplyText("").ok); // empty = use default

  assert.equal(validateThanksReplyText("You're welcome! We can book you tomorrow.").ok, false);
  assert.equal(validateThanksReplyText("Appointment confirmed. See you soon.").ok, false);
  assert.equal(validateThanksReplyText("Thanks! Limited time discount inside.").ok, false);
  assert.equal(validateThanksReplyText("Email us at a@b.com").ok, false);
  assert.equal(validateThanksReplyText("Call 224-532-9236").ok, false);
  assert.equal(validateThanksReplyText("Thanks, {{patient_name}}.").ok, false); // no variables
  assert.equal(validateThanksReplyText("Reply 1 for a callback").ok, false); // no digits
});

test("special replies + anti-spam migration is additive and idempotent", () => {
  const sql = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260624000100_sms_special_replies_and_anti_spam.sql",
    ),
    "utf8",
  );

  // special_reply role with sequence 1-2 joins the existing roles.
  assert.match(sql, /template_role in \('initial', 'auto_reply', 'voice_greeting', 'special_reply'\)/);
  assert.match(sql, /template_role = 'special_reply' and sequence between 1 and 2/);
  assert.match(sql, /template_role = 'auto_reply' and sequence between 1 and 10/);
  assert.match(sql, /template_role = 'voice_greeting' and sequence between 1 and 3/);

  // Anti-spam settings columns (NULL = code default) + range checks.
  assert.match(sql, /add column if not exists unanswered_mute_after int/);
  assert.match(sql, /add column if not exists unanswered_high_volume_after int/);
  assert.match(sql, /add column if not exists automation_mute_hours int/);
  assert.match(sql, /unanswered_mute_after between 1 and 100/);
  assert.match(sql, /unanswered_high_volume_after between 1 and 200/);
  assert.match(sql, /automation_mute_hours between 1 and 168/);

  // Conversation volume state.
  assert.match(sql, /add column if not exists unanswered_after_automation_count int not null default 0/);
  assert.match(sql, /add column if not exists automation_muted_until timestamptz/);
  assert.match(sql, /add column if not exists high_volume_flagged_at timestamptz/);
  assert.match(sql, /unanswered_after_automation_count >= 0/);

  // Data-safe: no destructive statements.
  assert.equal(/\bdrop\s+table\b/i.test(sql), false);
  assert.equal(/\bdelete\s+from\b/i.test(sql), false);
  assert.equal(/\bupdate\s+public\./i.test(sql), false);
});

test("voice greeting defaults render with clinic identity", () => {
  assert.equal(
    renderVoiceGreetingTemplate(DEFAULT_VOICE_GREETING_TEMPLATES.will_send, { clinicName: CLINIC }),
    "Hi, thanks for calling Fairstone Dental Smile. We're sorry we missed you. We'll send you a text now so our team can follow up.",
  );
  assert.equal(
    renderVoiceGreetingTemplate(DEFAULT_VOICE_GREETING_TEMPLATES.duplicate, { clinicName: CLINIC }),
    "Hi, thanks for calling Fairstone Dental Smile. We're sorry we missed you. We already sent a text, and our team will follow up shortly.",
  );
  assert.equal(
    renderVoiceGreetingTemplate(DEFAULT_VOICE_GREETING_TEMPLATES.none, { clinicName: CLINIC }),
    "Hi, thanks for calling Fairstone Dental Smile. We're sorry we missed you. Our team will follow up shortly.",
  );
});

test("voice greeting validation permits only safe clinic-name templates", () => {
  assert.ok(validateVoiceGreetingTemplate(DEFAULT_VOICE_GREETING_TEMPLATES.will_send, "will_send").ok);
  assert.equal(validateVoiceGreetingTemplate("Hi {{patient_name}}", "will_send").ok, false);
  assert.equal(validateVoiceGreetingTemplate("Visit https://example.com", "will_send").ok, false);
  assert.equal(validateVoiceGreetingTemplate("Call 224-532-9236", "will_send").ok, false);
  assert.equal(validateVoiceGreetingTemplate("We can book you tomorrow", "will_send").ok, false);
  assert.equal(
    validateVoiceGreetingTemplate(
      "Hi, thanks for calling {{clinic_name}}. We'll send you a text now.",
      "duplicate",
    ).ok,
    false,
  );
  assert.ok(validateVoiceGreetingTemplate(DEFAULT_VOICE_GREETING_TEMPLATES.duplicate, "duplicate").ok);
});

test("rendered follow-up never leaves an unresolved placeholder", () => {
  for (const slot of [1, 2, 3] as const) {
    const withName = renderConversationTemplate(DEFAULT_FOLLOW_UP_TEMPLATES[slot], {
      clinicName: CLINIC,
      patientName: "Sam",
    });
    const withoutName = renderConversationTemplate(DEFAULT_FOLLOW_UP_TEMPLATES[slot], {
      clinicName: CLINIC,
      patientName: null,
    });
    assert.ok(!withName.includes("{{") && !withName.includes("}}"));
    assert.ok(!withoutName.includes("{{") && !withoutName.includes("}}"));
  }
});

test("safety validation allows normal dental-office-neutral language", () => {
  for (const ok of [
    DEFAULT_INITIAL_TEMPLATE,
    "Thanks. The office will follow up.",
    "What name should we use?",
    "We'll pass this to the office.",
  ]) {
    assert.ok(validateFollowUpBody(ok).ok, `should allow: ${ok}`);
  }
});

test("safety validation rejects shouting and excessive punctuation", () => {
  assert.equal(validateFollowUpBody("CALL US RIGHT NOW PLEASE").ok, false);
  assert.equal(validateFollowUpBody("Hurry!!!").ok, false);
});
