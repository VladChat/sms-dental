import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  CLINIC_DELETE_CONFIRM,
  CLINIC_DELETE_KNOWN_TABLES,
  evaluateClinicDeleteSafety,
} from "../lib/db/admin/clinic-delete";

const REPO_ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

type SafetyInput = Parameters<typeof evaluateClinicDeleteSafety>[0];

const SAFE_INPUT: SafetyInput = {
  clinicFound: true,
  isActive: false,
  smsRecoveryEnabled: false,
  assignedPhoneCount: 0,
  assignedActivePhoneCount: 0,
  providerLinkedPhoneCount: 0,
  billingStatus: "not_started",
  stripeCustomerPresent: false,
  stripeSubscriptionPresent: false,
  stripePaymentMethodPresent: false,
  stripeSubscriptionItemPresent: false,
  providerLinkedPurchaseAttemptCount: 0,
  providerLinkedA2pSubmissionCount: 0,
  unknownLinkedRows: [],
  schemaInspectionFailed: false,
};

function codes(input: Partial<SafetyInput>): string[] {
  return evaluateClinicDeleteSafety({ ...SAFE_INPUT, ...input }).map((b) => b.code);
}

function blocker(input: Partial<SafetyInput>, code: string) {
  return evaluateClinicDeleteSafety({ ...SAFE_INPUT, ...input }).find((b) => b.code === code);
}

test("clinic delete safety blocks unknown clinic and active clinics", () => {
  assert.deepEqual(codes({ clinicFound: false }), ["clinic_not_found"]);

  const activeBlocker = blocker({ isActive: true }, "clinic_active");
  assert.ok(activeBlocker, "active clinic blocks deletion");
  assert.equal(activeBlocker.resolution, "Set clinic to inactive first.");
});

test("clinic delete safety groups billing blockers into one operator action", () => {
  const blocked = codes({
    billingStatus: "active",
    stripeCustomerPresent: true,
    stripeSubscriptionPresent: true,
    stripePaymentMethodPresent: true,
    stripeSubscriptionItemPresent: true,
  });

  assert.deepEqual(blocked, ["billing_connected"]);
  assert.ok(!blocked.includes("stripe_customer_present"));
  assert.ok(!blocked.includes("stripe_subscription_present"));
  assert.ok(!blocked.includes("stripe_payment_method_present"));
  assert.ok(!blocked.includes("stripe_subscription_item_present"));
  assert.ok(!blocked.includes("billing_status_not_safe"));
});

test("clinic delete safety groups phone blockers into one operator action", () => {
  const blocked = codes({
    assignedPhoneCount: 2,
    assignedActivePhoneCount: 1,
    providerLinkedPhoneCount: 1,
    providerLinkedPurchaseAttemptCount: 1,
  });

  assert.deepEqual(blocked, ["phone_attached"]);
  assert.ok(!blocked.includes("assigned_phone_active"));
  assert.ok(!blocked.includes("provider_linked_phone_number"));
  assert.ok(!blocked.includes("number_purchase_provider_state"));
});

test("clinic delete safety returns distinct grouped blockers together", () => {
  assert.deepEqual(
    codes({
      isActive: true,
      smsRecoveryEnabled: true,
      assignedPhoneCount: 1,
      billingStatus: "active",
      stripeCustomerPresent: true,
    }),
    ["clinic_active", "sms_recovery_enabled", "phone_attached", "billing_connected"],
  );
});

test("clinic delete safety allows inactive clinics only when provider and billing state are safe", () => {
  assert.deepEqual(evaluateClinicDeleteSafety(SAFE_INPUT), []);
});

test("clinic delete safety blocks provider-linked phone, number purchase, A2P, and unknown schema rows", () => {
  const blocked = codes({
    providerLinkedPhoneCount: 1,
    providerLinkedPurchaseAttemptCount: 1,
    providerLinkedA2pSubmissionCount: 1,
    unknownLinkedRows: [{ table: "new_table", label: "Unrecognized clinic data (new_table)", count: 1 }],
    schemaInspectionFailed: true,
  });

  assert.ok(blocked.includes("phone_attached"));
  assert.ok(blocked.includes("sms_approval_connected"));
  assert.ok(blocked.includes("unknown_clinic_data"));
  assert.ok(blocked.includes("schema_inspection_failed"));
});

test("clinic delete helper uses preflight, schema inspection, transaction, and ordered explicit deletes", () => {
  const src = read(path.join("lib", "db", "admin", "clinic-delete.ts"));

  assert.equal(CLINIC_DELETE_CONFIRM, "DELETE");
  assert.ok(src.includes("export async function getClinicDeletePreflight"));
  assert.ok(src.includes("export async function deleteClinicData"));
  assert.ok(src.includes("confirm !== CLINIC_DELETE_CONFIRM"));
  assert.ok(src.includes("ClinicDeleteConfirmationError"));
  assert.ok(src.includes("ClinicDeleteBlockedError"));
  assert.ok(src.includes("sql.begin(async (tx)"));
  assert.ok(src.includes("information_schema.columns"));
  assert.ok(src.includes("information_schema.table_constraints"));
  assert.ok(src.includes("unknown_clinic_data"));

  const beginIdx = src.indexOf("sql.begin(async (tx)");
  const preflightIdx = src.indexOf("const preflight = await buildClinicDeletePreflight", beginIdx);
  const deleteLoopIdx = src.indexOf("for (const def of CLINIC_DELETE_KNOWN_TABLES)", preflightIdx);
  const clinicDeleteIdx = src.indexOf("delete from public.clinics", deleteLoopIdx);
  assert.ok(preflightIdx > beginIdx, "preflight runs inside the transaction");
  assert.ok(deleteLoopIdx > preflightIdx, "explicit child table deletes run after preflight");
  assert.ok(clinicDeleteIdx > deleteLoopIdx, "clinic row is deleted last");

  for (const table of [
    "public.ai_voice_sessions",
    "public.messages",
    "public.patient_conversations",
    "public.call_events",
    "public.opt_outs",
    "public.clinic_blocked_patient_numbers",
    "public.clinic_phone_numbers",
    "public.clinic_phone_number_purchase_attempts",
    "public.clinic_number_requests",
    "public.clinic_sms_readiness",
    "public.clinic_sms_number_readiness",
    "public.clinic_a2p_submissions",
    "public.clinic_notification_preferences",
    "public.clinic_notifications",
    "public.clinic_memberships",
    "public.setup_requests",
    "public.admin_audit_events",
  ]) {
    const bare = table.replace("public.", "");
    assert.ok(
      CLINIC_DELETE_KNOWN_TABLES.some((def) => def.table === bare),
      `known delete plan includes ${table}`,
    );
  }

  assert.ok(!src.includes("public.webhook_events"), "webhook ingress logs are not deleted");
  assert.ok(!src.includes("getTwilioClient"), "helper makes no Twilio calls");
  assert.ok(!/from ["'][^"']*stripe[^"']*["']/i.test(src), "helper imports no Stripe SDK");
  assert.ok(!src.includes("messages.create"), "helper sends no SMS");
});

test("clinic delete API routes are platform-admin-only, URL-scoped, and confirmation-gated", () => {
  const preflight = read(
    path.join("app", "api", "admin", "clinics", "[clinicId]", "delete-preflight", "route.ts"),
  );
  assert.ok(preflight.includes("export async function GET"));
  assert.ok(preflight.includes("resolvePlatformAdmin(req)"));
  assert.ok(preflight.includes("const { clinicId } = await ctx.params"));
  assert.ok(preflight.includes("getClinicDeletePreflight(clinicId)"));
  assert.ok(!preflight.includes("await req.json"), "GET never reads clinic id from a body");

  const route = read(
    path.join("app", "api", "admin", "clinics", "[clinicId]", "delete", "route.ts"),
  );
  assert.ok(route.includes("export async function POST"));
  assert.ok(route.includes("resolvePlatformAdmin(req)"));
  assert.ok(route.includes("const { clinicId } = await ctx.params"));
  assert.ok(route.includes("z.literal(CLINIC_DELETE_CONFIRM)"));
  assert.ok(route.includes(".strict()"));
  assert.ok(route.includes("deleteClinicData(clinicId, parsed.data.confirm)"));
  assert.ok(route.includes("ClinicDeleteBlockedError"));
  assert.ok(route.includes("recordAdminAuditEvent"));
  assert.ok(route.includes("deletedCounts"));
  assert.ok(!route.includes("parsed.data.clinicId"), "POST never reads clinic id from body");
  assert.ok(!route.includes("getTwilioClient"), "route makes no Twilio calls");
  assert.ok(!/from ["'][^"']*stripe[^"']*["']/i.test(route), "route imports no Stripe SDK");
});

test("clinic delete UI lives in detail Admin tools, not the clinics list table", () => {
  const listPage = read(path.join("app", "admin", "(console)", "clinics", "page.tsx"));
  assert.ok(!listPage.includes("Delete clinic"), "clinic list has no delete button");

  const actions = read(
    path.join(
      "app", "admin", "(console)", "clinics", "[clinicId]", "_components",
      "AdminClinicActions.tsx",
    ),
  );
  for (const required of [
    "Danger zone",
    "Delete clinic",
    "Permanently removes this clinic and its test data from the app database. This does not touch Twilio or Stripe.",
    "/delete-preflight",
    "/delete",
    "Type DELETE to confirm.",
    "confirmValue === DELETE_CONFIRM",
    "!confirmReady",
    "Resolve these first.",
    "Data that will be deleted",
    "adm-delete-modal",
    "adm-delete-modal-body",
    "adm-delete-modal-footer",
    "maxHeight: \"calc(100dvh - 32px)\"",
    "overflowY: \"auto\"",
    "position: \"sticky\"",
    "aria-live=\"polite\"",
    "role=\"dialog\"",
  ]) {
    assert.ok(actions.includes(required), `delete UI includes ${required}`);
  }

  const consoleSrc = read(
    path.join(
      "app", "admin", "(console)", "clinics", "[clinicId]", "_components",
      "AdminClinicConsole.tsx",
    ),
  );
  const adminPanelIdx = consoleSrc.indexOf('<Panel id="admin"');
  const actionsIdx = consoleSrc.indexOf("<AdminClinicActions", adminPanelIdx);
  assert.ok(adminPanelIdx >= 0 && actionsIdx > adminPanelIdx, "delete action is under Admin tools");
});
