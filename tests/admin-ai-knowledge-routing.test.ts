import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

// Static routing guards for the dual-surface AI Knowledge feature. These verify
// the owner default path is preserved and the admin surface is platform-admin
// guarded and clinic-scoped by URL — without needing a browser or DB.

const REPO_ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const ADMIN_AI_DIR = path.join("app", "api", "admin", "clinics", "[clinicId]", "ai-knowledge");
const ADMIN_AI_SECTIONS = ["hours", "services", "insurance", "languages", "payment", "policies"];

test("owner AiKnowledgeCard defaults to the account AI knowledge API", () => {
  const src = read(path.join("app", "setup", "[token]", "_components", "AiKnowledgeCard.tsx"));
  assert.ok(
    /apiBasePath\s*=\s*"\/api\/account\/ai-knowledge"/.test(src),
    "AiKnowledgeCard must default apiBasePath to /api/account/ai-knowledge",
  );
  // All three fetches use the base path, not a hard-coded account literal.
  assert.ok(src.includes("fetch(apiBasePath,"));
  assert.ok(src.includes("`${apiBasePath}/${path}`"));
  assert.ok(src.includes("`${apiBasePath}/scan-website`"));
});

test("admin console drives AiKnowledgeCard with the admin clinic base path", () => {
  const src = read(
    path.join("app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminClinicConsole.tsx"),
  );
  assert.ok(
    src.includes("apiBasePath={`/api/admin/clinics/${d.id}/ai-knowledge`}"),
    "AdminClinicConsole must pass the admin clinic AI knowledge base path",
  );
});

test("owner AI knowledge routes still use the owner guard and account paths", () => {
  const ownerGet = read(path.join("app", "api", "account", "ai-knowledge", "route.ts"));
  assert.ok(ownerGet.includes("requireOwnerAdminAccess"));
  assert.ok(!ownerGet.includes("resolvePlatformAdmin"));
});

test("admin AI knowledge routes are platform-admin guarded and clinic-scoped", () => {
  const getRoute = read(path.join(ADMIN_AI_DIR, "route.ts"));
  assert.ok(getRoute.includes("requirePlatformAdminClinic"));
  assert.ok(!getRoute.includes("requireOwnerAdminAccess"));

  for (const section of ADMIN_AI_SECTIONS) {
    const src = read(path.join(ADMIN_AI_DIR, section, "route.ts"));
    assert.ok(
      src.includes("runAdminAiKnowledgeSave"),
      `admin ${section} route must use the platform-admin save runner`,
    );
    assert.ok(!src.includes("requireOwnerAdminAccess"), `admin ${section} route must not use the owner guard`);
  }

  const scan = read(path.join(ADMIN_AI_DIR, "scan-website", "route.ts"));
  assert.ok(scan.includes("requirePlatformAdminClinic"));
  assert.ok(!scan.includes("requireOwnerAdminAccess"));
});

test("the admin clinic guard takes the clinic id from the URL, never membership", () => {
  const guard = read(path.join("lib", "auth", "admin-clinic.ts"));
  assert.ok(guard.includes("resolvePlatformAdmin"));
  assert.ok(guard.includes("findClinicById(clinicId)"));
  // The runner forwards the URL clinic id to the section handler.
  const runner = read(path.join("lib", "ai-knowledge", "admin-route.ts"));
  assert.ok(runner.includes("await ctx.params"));
  assert.ok(runner.includes("requirePlatformAdminClinic(req, clinicId)"));
});
