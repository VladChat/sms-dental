import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import { resolveAdminSmsReadiness } from "../lib/db/admin/types";

const REPO_ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

// ---------------------------------------------------------------------------
// Part B/G — readiness status mapping (pure, no DB)
// ---------------------------------------------------------------------------

test("readiness mapping: ok true → verified + preserves reason", () => {
  const r = resolveAdminSmsReadiness({ kind: "evaluated", ok: true, reason: "verified" });
  assert.equal(r.smsReadinessStatus, "verified");
  assert.equal(r.smsReadinessReason, "verified");
});

test("readiness mapping: no active phone → no_phone (no reason)", () => {
  const r = resolveAdminSmsReadiness({ kind: "no_phone" });
  assert.equal(r.smsReadinessStatus, "no_phone");
  assert.equal(r.smsReadinessReason, null);
});

test("readiness mapping: ok false → needs_review + preserves blocking reason", () => {
  const r = resolveAdminSmsReadiness({
    kind: "evaluated",
    ok: false,
    reason: "phone_number_texting_not_active:+18445551234",
  });
  assert.equal(r.smsReadinessStatus, "needs_review");
  assert.equal(r.smsReadinessReason, "phone_number_texting_not_active:+18445551234");
});

test("readiness mapping: thrown check → unknown (fails closed)", () => {
  const r = resolveAdminSmsReadiness({ kind: "error" });
  assert.equal(r.smsReadinessStatus, "unknown");
  assert.equal(r.smsReadinessReason, "sms_readiness_check_failed");
});

test("readiness mapping never returns verified for a blocked check", () => {
  // A blocked readiness result must never be presented as Verified.
  const r = resolveAdminSmsReadiness({ kind: "evaluated", ok: false, reason: "no_active_sms_numbers" });
  assert.notEqual(r.smsReadinessStatus, "verified");
  assert.equal(r.smsReadinessStatus, "needs_review");
});

// ---------------------------------------------------------------------------
// Part C/G — AdminUI list label + tone helpers (server-safe, no raw enums)
// ---------------------------------------------------------------------------

test("AdminUI exposes SMS readiness list label + tone helpers", () => {
  const src = read(path.join("app", "admin", "(console)", "_components", "AdminUI.tsx"));
  assert.ok(src.includes("export function smsReadinessListLabel"));
  assert.ok(src.includes("export function smsReadinessListTone"));
});

test("AdminUI maps readiness statuses to operator-friendly labels", () => {
  const src = read(path.join("app", "admin", "(console)", "_components", "AdminUI.tsx"));
  assert.ok(src.includes('verified: "Verified"'));
  assert.ok(src.includes('needs_review: "Needs review"'));
  assert.ok(src.includes('no_phone: "No phone"'));
  assert.ok(src.includes('unknown: "Unknown"'));
});

test("AdminUI maps readiness statuses to safe tones", () => {
  const src = read(path.join("app", "admin", "(console)", "_components", "AdminUI.tsx"));
  // verified → success, no_phone → neutral, blocked/failed → warning (visible)
  assert.ok(src.includes('verified: "success"'));
  assert.ok(src.includes('needs_review: "warning"'));
  assert.ok(src.includes('no_phone: "neutral"'));
});

// ---------------------------------------------------------------------------
// Part D/G — Clinics table column
// ---------------------------------------------------------------------------

test("Clinics list header is 'SMS readiness', not 'Setup'", () => {
  const src = read(path.join("app", "admin", "(console)", "clinics", "page.tsx"));
  assert.ok(src.includes("<th>SMS readiness</th>"));
  assert.ok(!src.includes("<th>Setup</th>"));
});

test("Clinics list renders readiness via helpers, never raw clinics.sms_status", () => {
  const src = read(path.join("app", "admin", "(console)", "clinics", "page.tsx"));
  // New cell uses the readiness label/tone helpers.
  assert.ok(src.includes("smsReadinessListTone(c.smsReadinessStatus)"));
  assert.ok(src.includes("smsReadinessListLabel(c.smsReadinessStatus)"));
  // Raw sms_status (e.g. "waiting_for_approval") is no longer rendered/toned here.
  assert.ok(!src.includes("smsStatusTone(c.smsStatus)"));
  assert.ok(!src.includes("{c.smsStatus}"));
});

test("Clinics list keeps the separate 'SMS recovery' on/off column", () => {
  const src = read(path.join("app", "admin", "(console)", "clinics", "page.tsx"));
  assert.ok(src.includes("<th>SMS recovery</th>"));
  assert.ok(src.includes("c.smsRecoveryEnabled"));
});

// ---------------------------------------------------------------------------
// Part B/G — list readiness is DB-backed and provider-free (static guard)
// ---------------------------------------------------------------------------

test("listAdminClinics computes readiness from evaluateTextingStatusForLaunch, fail-closed", () => {
  const src = read(path.join("lib", "db", "admin", "clinics.ts"));
  assert.ok(src.includes("evaluateTextingStatusForLaunch"));
  assert.ok(src.includes("resolveAdminSmsReadiness"));
  // Fail-closed: a thrown readiness check maps to "unknown".
  assert.ok(src.includes('kind: "error"'));
  // No provider calls from the list path.
  assert.ok(!/\bnew Twilio\b/.test(src));
});
