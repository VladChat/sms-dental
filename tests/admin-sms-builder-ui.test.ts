import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
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

test("admin SMS builder uses one full-template initial textarea", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminSmsConversationBuilder.tsx"),
  );
  assert.ok(src.includes('id="aisms-initial-template"'));
  assert.ok(src.includes("Initial SMS"));
  assert.ok(!src.includes("Locked start"));
  assert.ok(!src.includes("Locked end"));
  assert.ok(!src.includes("Editable middle text"));
  assert.ok(!src.includes("initialMiddle"));
});

test("admin SMS builder is read-only first and uses edit/save/saved flow", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminSmsConversationBuilder.tsx"),
  );
  assert.ok(src.includes("const [editing, setEditing] = useState(false)"));
  assert.ok(src.includes("function beginEdit()"));
  assert.ok(src.includes("setEditing(true)"));
  assert.ok(src.includes("setEditing(false)"));
  assert.ok(src.includes("onClick={beginEdit}"));
  assert.ok(src.includes("Edit"));
  assert.ok(src.includes('className="btn btn-secondary"'));
  assert.ok(src.includes('className="btn btn-primary"'));
  assert.ok(src.includes("Save"));
  assert.ok(src.includes("Saved."));
  assert.ok(src.includes("readOnly={!editing}"));
  assert.ok(src.includes("disabled={!editing || saving}"));
});

test("admin SMS builder removes suggestion/default helper lines and resets only in edit mode", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminSmsConversationBuilder.tsx"),
  );
  assert.ok(!src.includes("Suggestion:"));
  assert.ok(!src.includes("Default:"));
  assert.ok(!src.includes("use “"));
  assert.ok(!src.includes('use "'));
  assert.ok(src.includes("Reset to default"));
  assert.ok(src.includes("editing && ("));
  assert.ok(src.includes("setInitialTemplate(defaultInitialTemplate)"));
  assert.ok(src.includes("body: followUps[slot].defaultText"));
  assert.ok(src.includes("body: voiceGreetings[scenario].defaultText"));
});

test("admin SMS builder orders voice greetings before SMS messages with exact helper copy", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminSmsConversationBuilder.tsx"),
  );
  const voiceIdx = src.indexOf(">Voice greeting</h3>");
  const smsIdx = src.indexOf(">SMS messages</h3>");
  assert.ok(voiceIdx >= 0);
  assert.ok(smsIdx > voiceIdx);
  assert.ok(src.includes("Callers hear this before the call ends. The system chooses the correct version automatically."));
  assert.ok(src.includes("When a new SMS will be sent"));
  assert.ok(src.includes("When this caller was already texted recently"));
  assert.ok(src.includes("When no SMS will be sent"));
});

test("admin SMS builder shows compact variables, SMS block labels, and active previews", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminSmsConversationBuilder.tsx"),
  );
  assert.ok(src.includes("SMS variables:"));
  assert.ok(src.includes("Voice variables:"));
  assert.ok(src.includes("{{clinic_name}}"));
  assert.ok(src.includes("{{patient_name}}"));
  assert.ok(src.includes("Initial SMS"));
  assert.ok(src.includes("Follow-up #{slot}"));
  assert.ok(src.includes("Additional follow-ups"));
  assert.ok(src.includes("Follow-ups #4-#10 require custom text before they can be enabled."));
  assert.ok(src.includes("Maximum automated replies"));
  assert.ok(src.includes("setInitialTemplate(data.config.initial.effectiveText)"));
  assert.ok(src.includes("body: fu?.effectiveText ?? defaultText"));
  assert.ok(src.includes("body: vg?.effectiveText ?? defaultText"));
  assert.ok(src.includes("initialTemplate,"));
});

test("admin SMS builder exposes 10 follow-up slots with custom-only additional slots", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminSmsConversationBuilder.tsx"),
  );
  assert.ok(src.includes("const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const"));
  assert.ok(src.includes("const ADDITIONAL_SLOTS = [4, 5, 6, 7, 8, 9, 10] as const"));
  assert.ok(src.includes("const SLOTS_WITH_ZERO = [0, ...SLOTS] as const"));
  assert.ok(src.includes("body.trim().length > 0 || followUps[slot].hasCodeTemplate"));
  assert.ok(src.includes("!state.hasCodeTemplate && body.trim().length === 0 ? { enabled: false } : {}"));
  assert.ok(src.includes("state.hasCodeTemplate ? \"Reset to default\" : \"Clear\""));
});

test("admin SMS conversation route is platform-admin guarded and validates full initial template", () => {
  const src = read(path.join("app", "api", "admin", "clinics", "[clinicId]", "sms-conversation", "route.ts"));
  assert.ok(src.includes("requirePlatformAdminClinic"));
  assert.ok(src.includes("validateInitialTemplate"));
  assert.ok(src.includes("initialTemplate"));
});

test("admin SMS builder exposes editable voice greeting scenarios", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminSmsConversationBuilder.tsx"),
  );
  assert.ok(src.includes("Voice greeting"));
  assert.ok(src.includes("Callers hear this before the call ends. The system chooses the correct version automatically."));
  assert.ok(src.includes("will_send"));
  assert.ok(src.includes("duplicate"));
  assert.ok(src.includes("none"));
  assert.ok(src.includes("Reset to default"));
  assert.ok(src.includes("{{clinic_name}}"));
});

test("admin SMS conversation route validates and audits voice greetings without bodies", () => {
  const src = read(path.join("app", "api", "admin", "clinics", "[clinicId]", "sms-conversation", "route.ts"));
  assert.ok(src.includes("validateVoiceGreetingTemplate"));
  assert.ok(src.includes("voiceGreetings"));
  assert.ok(src.includes("voice_customized_count"));
  assert.ok(src.includes("follow_up_enabled_count"));
  assert.ok(src.includes("customBody"));
  assert.ok(src.includes("effectiveText"));
  assert.ok(src.includes("defaultText"));
  assert.ok(!src.includes("suggestion"));
  assert.ok(!src.includes("initial_body"));
  assert.ok(!src.includes("voice_body"));
});

test("admin SMS conversation route allows 10 follow-ups but requires custom text after slot 3", () => {
  const src = read(path.join("app", "api", "admin", "clinics", "[clinicId]", "sms-conversation", "route.ts"));
  assert.ok(src.includes("AUTO_REPLY_SLOTS"));
  assert.ok(src.includes("MAX_AUTO_REPLIES"));
  assert.ok(src.includes("Choose between 0 and ${MAX_AUTO_REPLIES} automated replies."));
  assert.ok(src.includes("Follow-up #${slot} needs custom text before it can be enabled."));
  assert.ok(src.includes("Add custom text to follow-up #${slot} before allowing"));
  assert.ok(src.includes("defaultFollowUpTemplateForSlot(slot)"));
});

test("clinic owner account does not expose SMS template editing", () => {
  const files = listSourceFiles(path.join(REPO_ROOT, "app", "account"));
  const offenders = files
    .filter((file) => {
      const src = fs.readFileSync(file, "utf8");
      return src.includes("AdminSmsConversationBuilder") || src.includes("/sms-conversation");
    })
    .map((file) => path.relative(REPO_ROOT, file));

  assert.deepEqual(offenders, []);
});

// ---------------------------------------------------- SMS settings nav split

test("admin left nav groups Voice greeting / SMS texts / Limits & anti-spam under SMS settings", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminClinicConsole.tsx"),
  );

  // Grouped child items replace the old single section.
  assert.ok(src.includes('{ id: "sms_voice", label: "Voice greeting", group: "SMS settings" }'));
  assert.ok(src.includes('{ id: "sms_texts", label: "SMS texts", group: "SMS settings" }'));
  assert.ok(src.includes('{ id: "sms_limits", label: "Limits & anti-spam", group: "SMS settings" }'));
  assert.ok(!src.includes("sms_messages"), "old single SMS messages section is gone");

  // Group label renders once above the first child; keyboard nav stays a flat
  // roving-tab list over SECTIONS.
  assert.ok(src.includes("const isGroupStart = !!s.group && SECTIONS[i - 1]?.group !== s.group"));
  assert.ok(src.includes("onTabKeyDown(e, i)"));
  assert.ok(src.includes('role="tablist"'));

  // Existing main sections stay in order around the group.
  const order = ["\"phone\"", "\"business\"", "\"sms\"", "\"a2p\"", "\"ai_knowledge\"", "\"sms_voice\"", "\"sms_texts\"", "\"sms_limits\"", "\"billing\"", "\"admin\""]
    .map((id) => src.indexOf(`{ id: ${id},`));
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(order[i] > order[i - 1], `nav order broken at index ${i}`);
  }

  // Three focused panels render the builder with a view prop each.
  assert.ok(src.includes('<AdminSmsConversationBuilder clinicId={d.id} view="voice" />'));
  assert.ok(src.includes('<AdminSmsConversationBuilder clinicId={d.id} view="texts" />'));
  assert.ok(src.includes('<AdminSmsConversationBuilder clinicId={d.id} view="limits" />'));
  assert.ok(!src.includes("<AdminSmsConversationBuilder clinicId={d.id} />"));
});

test("builder subviews render only their own settings and save only their own section", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminSmsConversationBuilder.tsx"),
  );

  assert.ok(src.includes('view: SmsBuilderView'));
  assert.ok(src.includes('export type SmsBuilderView = "voice" | "texts" | "limits"'));
  assert.ok(src.includes('{view === "voice" && ('));
  assert.ok(src.includes('{view === "texts" && ('));
  assert.ok(src.includes('{view === "limits" && ('));

  // Partial save payloads: voice -> voiceGreetings only; texts -> initial +
  // follow-ups + special replies; limits -> maxAutoReplies + antiSpam.
  const payloadStart = src.indexOf("function buildSavePayload()");
  const payload = src.slice(payloadStart, src.indexOf("async function save()"));
  const voiceBranch = payload.slice(payload.indexOf('view === "voice"'), payload.indexOf('view === "texts"'));
  assert.ok(voiceBranch.includes("voiceGreetings:"));
  assert.ok(!voiceBranch.includes("initialTemplate"));
  assert.ok(!voiceBranch.includes("maxAutoReplies"));
  const limitsBranchIdx = payload.lastIndexOf("return {");
  const textsBranch = payload.slice(payload.indexOf('view === "texts"'), limitsBranchIdx);
  assert.ok(textsBranch.includes("initialTemplate,"));
  assert.ok(textsBranch.includes("followUps:"));
  assert.ok(textsBranch.includes("specialReplies:"));
  assert.ok(!textsBranch.includes("voiceGreetings"));
  const limitsBranch = payload.slice(limitsBranchIdx);
  assert.ok(limitsBranch.includes("maxAutoReplies,"));
  assert.ok(limitsBranch.includes("antiSpam:"));
});

test("SMS texts panel exposes editable Safety notice and Thanks reply blocks", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminSmsConversationBuilder.tsx"),
  );

  assert.ok(src.includes('label: "Safety notice"'));
  assert.ok(src.includes('label: "Thanks reply"'));
  assert.ok(src.includes("resetSpecialReply"));
  assert.ok(src.includes("body: specialReplies[key].defaultText"));
  // The safety notice is visually a prefix/add-on: the preview shows it glued
  // to the next follow-up as ONE SMS, never a separate message.
  assert.ok(src.includes("Example (prefix + next follow-up, one SMS)"));
  assert.ok(src.includes("${state.body.trim() || state.defaultText} ${localFollowUpPreviews[1]}"));
});

test("Limits & anti-spam panel exposes max replies and pause settings with helper copy", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminSmsConversationBuilder.tsx"),
  );

  assert.ok(src.includes("Maximum automated replies"));
  assert.ok(src.includes("Pause automation after"));
  assert.ok(src.includes("Pause duration"));
  assert.ok(src.includes("High-volume flag after"));
  assert.ok(src.includes("unansweredMuteAfter: 6"));
  assert.ok(src.includes("unansweredHighVolumeAfter: 10"));
  assert.ok(src.includes("automationMuteHours: 24"));
  assert.ok(
    src.includes(
      "After automated replies are finished, additional patient messages are still saved.",
    ),
  );
  assert.ok(src.includes("automation can pause temporarily to"));
  assert.ok(src.includes("number is never blocked"));
});

test("admin SMS conversation route supports partial saves and validates special replies + anti-spam", () => {
  const src = read(path.join("app", "api", "admin", "clinics", "[clinicId]", "sms-conversation", "route.ts"));

  // Partial-save merge: each section falls back to the saved config.
  assert.ok(src.includes("const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key)"));
  assert.ok(src.includes('if (has("maxAutoReplies"))'));
  assert.ok(src.includes('if (has("followUps"))'));
  assert.ok(src.includes('if (has("voiceGreetings"))'));
  assert.ok(src.includes('if (has("specialReplies"))'));
  assert.ok(src.includes('if (has("antiSpam"))'));

  // Special reply validation routes to the dedicated validators.
  assert.ok(src.includes("validateSafetyNoticeText"));
  assert.ok(src.includes("validateThanksReplyText"));

  // Anti-spam validation enforces bounds + cross-field rule server-side.
  assert.ok(src.includes("validateAutomationVolumeSettings"));

  // Audit stays compact and body-free with the new metadata.
  assert.ok(src.includes("changed_section: changedSection(has)"));
  assert.ok(src.includes("special_reply_customized_count"));
  assert.ok(src.includes("anti_spam_customized"));

  // GET/POST responses expose the new sections.
  assert.ok(src.includes("specialReplies,"));
  assert.ok(src.includes("antiSpamBounds: AUTOMATION_VOLUME_BOUNDS"));
  assert.ok(src.includes("maxSpecialReplyLength: MAX_SPECIAL_REPLY_LENGTH"));
});
