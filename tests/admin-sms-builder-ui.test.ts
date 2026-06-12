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
  assert.ok(src.includes("Maximum automated replies"));
  assert.ok(src.includes("setInitialTemplate(data.config.initialTemplate ?? data.config.defaultInitialTemplate)"));
  assert.ok(src.includes("body: fu?.body ?? defaultText"));
  assert.ok(src.includes("body: vg?.body ?? defaultText"));
  assert.ok(src.includes("initialTemplate,"));
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
  assert.ok(!src.includes("initial_body"));
  assert.ok(!src.includes("voice_body"));
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
