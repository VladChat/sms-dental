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
  assert.ok(src.includes("Initial SMS template"));
  assert.ok(!src.includes("Locked start"));
  assert.ok(!src.includes("Locked end"));
  assert.ok(!src.includes("Editable middle text"));
  assert.ok(!src.includes("initialMiddle"));
});

test("initial suggestion click inserts the suggested full template", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminSmsConversationBuilder.tsx"),
  );
  assert.ok(src.includes("initialSuggestion"));
  assert.ok(src.includes("Suggestion:"));
  assert.ok(src.includes("setInitialTemplate(initialSuggestion)"));
  assert.ok(src.includes("initialTemplate,"));
});

test("admin SMS conversation route is platform-admin guarded and validates full initial template", () => {
  const src = read(path.join("app", "api", "admin", "clinics", "[clinicId]", "sms-conversation", "route.ts"));
  assert.ok(src.includes("requirePlatformAdminClinic"));
  assert.ok(src.includes("validateInitialTemplate"));
  assert.ok(src.includes("initialTemplate"));
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
