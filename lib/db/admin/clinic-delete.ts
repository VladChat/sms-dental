import type { Sql, TransactionSql } from "postgres";

import { getDb } from "../client";

type DbExecutor = Sql | TransactionSql;

export const CLINIC_DELETE_CONFIRM = "DELETE";

export type ClinicDeleteBlocker = {
  code: string;
  message: string;
  resolution: string;
};

export type ClinicDeleteTableCount = {
  table: string;
  label: string;
  count: number;
};

export type ClinicDeleteSummary = {
  clinicId: string;
  clinicName: string;
  slug: string | null;
  ownerEmail: string | null;
  active: boolean;
  smsRecoveryEnabled: boolean;
  assignedPhoneCount: number;
  assignedActivePhoneCount: number;
  billingStatus: string | null;
  stripeCustomerPresent: boolean;
  stripeSubscriptionPresent: boolean;
  stripePaymentMethodPresent: boolean;
  patientConversationCount: number;
  messageCount: number;
  callEventCount: number;
  aiVoiceSessionCount: number;
  notificationCount: number;
  optOutCount: number;
  blockedNumberCount: number;
  adminAuditCount: number;
  tableCounts: ClinicDeleteTableCount[];
};

export type ClinicDeletePreflight = {
  ok: true;
  canDelete: boolean;
  blockers: ClinicDeleteBlocker[];
  summary: ClinicDeleteSummary | null;
};

export type ClinicDeleteResult = {
  ok: true;
  canDelete: true;
  blockers: [];
  summary: ClinicDeleteSummary;
  deletedCounts: ClinicDeleteTableCount[];
};

type ClinicDeleteKnownTable = {
  table: string;
  label: string;
};

export const CLINIC_DELETE_KNOWN_TABLES: readonly ClinicDeleteKnownTable[] = [
  { table: "ai_voice_sessions", label: "AI answered calls" },
  { table: "messages", label: "Messages" },
  { table: "clinic_blocked_patient_numbers", label: "Blocked phone numbers" },
  { table: "patient_conversations", label: "Patient requests" },
  { table: "call_events", label: "Call records" },
  { table: "opt_outs", label: "Opt-outs" },
  { table: "clinic_notifications", label: "Notifications" },
  { table: "clinic_notification_preferences", label: "Notification settings" },
  { table: "clinic_ai_answering_settings", label: "AI Answering settings" },
  { table: "clinic_ai_hours", label: "Office hours facts" },
  { table: "clinic_ai_services", label: "Service facts" },
  { table: "clinic_ai_insurance_plans", label: "Insurance facts" },
  { table: "clinic_ai_appointment_settings", label: "Appointment request facts" },
  { table: "clinic_ai_payment_settings", label: "Payment facts" },
  { table: "clinic_ai_financing_options", label: "Financing facts" },
  { table: "clinic_ai_office_policies", label: "Office policy facts" },
  { table: "clinic_ai_knowledge_section_reviews", label: "AI knowledge reviews" },
  { table: "clinic_ai_knowledge_entries", label: "Legacy AI knowledge entries" },
  { table: "clinic_website_scan_runs", label: "Website scan history" },
  { table: "clinic_sms_message_templates", label: "SMS message templates" },
  { table: "clinic_sms_conversation_settings", label: "SMS settings" },
  { table: "clinic_sms_number_readiness", label: "Number SMS readiness" },
  { table: "clinic_sms_readiness", label: "SMS readiness" },
  { table: "clinic_a2p_submissions", label: "SMS approval records" },
  { table: "clinic_phone_number_purchase_attempts", label: "Number purchase attempts" },
  { table: "clinic_number_requests", label: "Number requests" },
  { table: "setup_requests", label: "Setup requests" },
  { table: "clinic_memberships", label: "Team access" },
  { table: "clinic_phone_numbers", label: "Phone number assignments" },
  { table: "admin_audit_events", label: "Admin history" },
];

const KNOWN_TABLE_NAMES = new Set(CLINIC_DELETE_KNOWN_TABLES.map((t) => t.table));
const TABLE_LABELS = new Map(CLINIC_DELETE_KNOWN_TABLES.map((t) => [t.table, t.label]));

type ClinicDeleteSafetyInput = {
  clinicFound: boolean;
  smsRecoveryEnabled: boolean;
  assignedActivePhoneCount: number;
  providerLinkedPhoneCount: number;
  billingStatus: string | null;
  stripeCustomerPresent: boolean;
  stripeSubscriptionPresent: boolean;
  stripePaymentMethodPresent: boolean;
  stripeSubscriptionItemPresent: boolean;
  providerLinkedPurchaseAttemptCount: number;
  providerLinkedA2pSubmissionCount: number;
  unknownLinkedRows: ClinicDeleteTableCount[];
  schemaInspectionFailed: boolean;
};

export function evaluateClinicDeleteSafety(input: ClinicDeleteSafetyInput): ClinicDeleteBlocker[] {
  const blockers: ClinicDeleteBlocker[] = [];

  if (!input.clinicFound) {
    blockers.push({
      code: "clinic_not_found",
      message: "Clinic not found.",
      resolution: "Open an existing clinic record before deleting.",
    });
    return blockers;
  }

  if (input.schemaInspectionFailed) {
    blockers.push({
      code: "schema_inspection_failed",
      message: "The delete preflight could not verify every clinic data table.",
      resolution: "Retry after the database schema can be inspected.",
    });
  }

  if (input.smsRecoveryEnabled) {
    blockers.push({
      code: "sms_recovery_enabled",
      message: "SMS recovery is on.",
      resolution: "Pause SMS recovery first.",
    });
  }

  if (input.assignedActivePhoneCount > 0) {
    blockers.push({
      code: "assigned_phone_active",
      message: "An assigned phone number is still active.",
      resolution: "Detach the assigned phone number first.",
    });
  } else if (input.providerLinkedPhoneCount > 0) {
    blockers.push({
      code: "provider_linked_phone_number",
      message: "A phone number is still linked to provider-owned inventory.",
      resolution: "Remove provider-linked phone state first.",
    });
  }

  if (input.stripeCustomerPresent) {
    blockers.push({
      code: "stripe_customer_present",
      message: "A billing customer is connected.",
      resolution: "Remove billing/provider-linked state first.",
    });
  }
  if (input.stripeSubscriptionPresent) {
    blockers.push({
      code: "stripe_subscription_present",
      message: "A billing subscription is connected.",
      resolution: "Remove billing/provider-linked state first.",
    });
  }
  if (input.stripePaymentMethodPresent) {
    blockers.push({
      code: "stripe_payment_method_present",
      message: "A saved payment method is connected.",
      resolution: "Remove billing/provider-linked state first.",
    });
  }
  if (input.stripeSubscriptionItemPresent) {
    blockers.push({
      code: "stripe_subscription_item_present",
      message: "Billing item state is connected.",
      resolution: "Remove billing/provider-linked state first.",
    });
  }

  if (input.billingStatus !== "not_started") {
    blockers.push({
      code: "billing_status_not_safe",
      message: "Billing status is not safe for deletion.",
      resolution: "Return billing to not started before deleting.",
    });
  }

  if (input.providerLinkedPurchaseAttemptCount > 0) {
    blockers.push({
      code: "number_purchase_provider_state",
      message: "A number purchase is still linked to phone or billing provider state.",
      resolution: "Resolve the number purchase attempt first.",
    });
  }

  if (input.providerLinkedA2pSubmissionCount > 0) {
    blockers.push({
      code: "sms_approval_provider_state",
      message: "SMS approval state is still linked to provider records.",
      resolution: "Remove provider-linked approval state first.",
    });
  }

  if (input.unknownLinkedRows.length > 0) {
    blockers.push({
      code: "unknown_clinic_data",
      message: "There is clinic data this delete flow does not know how to remove.",
      resolution: "Update the delete helper for the newly discovered clinic data first.",
    });
  }

  return blockers;
}

type ClinicRow = {
  id: string;
  name: string;
  slug: string | null;
  owner_contact_email: string | null;
  is_active: boolean;
  sms_recovery_enabled: boolean;
  billing_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_method_id: string | null;
  stripe_base_subscription_item_id: string | null;
  stripe_additional_number_subscription_item_id: string | null;
  stripe_local_number_subscription_item_id: string | null;
  stripe_local_sms_compliance_subscription_item_id: string | null;
};

type PhoneSafetyRow = {
  assigned_count: number;
  active_count: number;
  provider_linked_count: number;
};

type CountByTableOptions = {
  includeUnknownRows: boolean;
};

export async function getClinicDeletePreflight(
  clinicId: string,
): Promise<ClinicDeletePreflight> {
  return buildClinicDeletePreflight(clinicId, getDb());
}

async function buildClinicDeletePreflight(
  clinicId: string,
  q: DbExecutor,
): Promise<ClinicDeletePreflight> {
  const clinicRows = await q<ClinicRow[]>`
    select
      id, name, slug, owner_contact_email, is_active, sms_recovery_enabled,
      billing_status, stripe_customer_id, stripe_subscription_id,
      stripe_payment_method_id, stripe_base_subscription_item_id,
      stripe_additional_number_subscription_item_id,
      stripe_local_number_subscription_item_id,
      stripe_local_sms_compliance_subscription_item_id
    from public.clinics
    where id = ${clinicId}
    limit 1
  `;
  const clinic = clinicRows[0] ?? null;

  let existingClinicTables: Set<string>;
  let unknownLinkedRows: ClinicDeleteTableCount[] = [];
  let schemaInspectionFailed = false;

  try {
    existingClinicTables = new Set(await listClinicScopedTables(q));
    unknownLinkedRows = await countUnknownLinkedRows(q, clinicId, existingClinicTables);
  } catch {
    existingClinicTables = new Set();
    schemaInspectionFailed = true;
  }

  if (!clinic) {
    return {
      ok: true,
      canDelete: false,
      blockers: evaluateClinicDeleteSafety({
        clinicFound: false,
        smsRecoveryEnabled: false,
        assignedActivePhoneCount: 0,
        providerLinkedPhoneCount: 0,
        billingStatus: null,
        stripeCustomerPresent: false,
        stripeSubscriptionPresent: false,
        stripePaymentMethodPresent: false,
        stripeSubscriptionItemPresent: false,
        providerLinkedPurchaseAttemptCount: 0,
        providerLinkedA2pSubmissionCount: 0,
        unknownLinkedRows: [],
        schemaInspectionFailed,
      }),
      summary: null,
    };
  }

  const [tableCounts, phoneSafety, providerLinkedPurchaseAttemptCount, providerLinkedA2pSubmissionCount] =
    await Promise.all([
      countKnownTables(q, clinicId, existingClinicTables, { includeUnknownRows: true }),
      readPhoneSafety(q, clinicId, existingClinicTables),
      countProviderLinkedPurchaseAttempts(q, clinicId, existingClinicTables),
      countProviderLinkedA2pSubmissions(q, clinicId, existingClinicTables),
    ]);

  const tableCountWithClinic = [
    { table: "clinics", label: "Clinic record", count: 1 },
    ...tableCounts,
    ...unknownLinkedRows,
  ];
  const countFor = (table: string) =>
    tableCountWithClinic.find((row) => row.table === table)?.count ?? 0;

  const stripeSubscriptionItemPresent = Boolean(
    clinic.stripe_base_subscription_item_id ||
      clinic.stripe_additional_number_subscription_item_id ||
      clinic.stripe_local_number_subscription_item_id ||
      clinic.stripe_local_sms_compliance_subscription_item_id,
  );

  const blockers = evaluateClinicDeleteSafety({
    clinicFound: true,
    smsRecoveryEnabled: clinic.sms_recovery_enabled,
    assignedActivePhoneCount: phoneSafety.active_count,
    providerLinkedPhoneCount: phoneSafety.provider_linked_count,
    billingStatus: clinic.billing_status,
    stripeCustomerPresent: Boolean(clinic.stripe_customer_id),
    stripeSubscriptionPresent: Boolean(clinic.stripe_subscription_id),
    stripePaymentMethodPresent: Boolean(clinic.stripe_payment_method_id),
    stripeSubscriptionItemPresent,
    providerLinkedPurchaseAttemptCount,
    providerLinkedA2pSubmissionCount,
    unknownLinkedRows,
    schemaInspectionFailed,
  });

  return {
    ok: true,
    canDelete: blockers.length === 0,
    blockers,
    summary: {
      clinicId: clinic.id,
      clinicName: clinic.name,
      slug: clinic.slug,
      ownerEmail: clinic.owner_contact_email,
      active: clinic.is_active,
      smsRecoveryEnabled: clinic.sms_recovery_enabled,
      assignedPhoneCount: phoneSafety.assigned_count,
      assignedActivePhoneCount: phoneSafety.active_count,
      billingStatus: clinic.billing_status,
      stripeCustomerPresent: Boolean(clinic.stripe_customer_id),
      stripeSubscriptionPresent: Boolean(clinic.stripe_subscription_id),
      stripePaymentMethodPresent: Boolean(clinic.stripe_payment_method_id),
      patientConversationCount: countFor("patient_conversations"),
      messageCount: countFor("messages"),
      callEventCount: countFor("call_events"),
      aiVoiceSessionCount: countFor("ai_voice_sessions"),
      notificationCount: countFor("clinic_notifications"),
      optOutCount: countFor("opt_outs"),
      blockedNumberCount: countFor("clinic_blocked_patient_numbers"),
      adminAuditCount: countFor("admin_audit_events"),
      tableCounts: tableCountWithClinic,
    },
  };
}

export class ClinicDeleteConfirmationError extends Error {
  constructor() {
    super("Type DELETE to confirm.");
    this.name = "ClinicDeleteConfirmationError";
  }
}

export class ClinicDeleteBlockedError extends Error {
  preflight: ClinicDeletePreflight;

  constructor(preflight: ClinicDeletePreflight) {
    super("Clinic delete is blocked.");
    this.name = "ClinicDeleteBlockedError";
    this.preflight = preflight;
  }
}

export async function deleteClinicData(
  clinicId: string,
  confirm: string,
): Promise<ClinicDeleteResult> {
  if (confirm !== CLINIC_DELETE_CONFIRM) {
    throw new ClinicDeleteConfirmationError();
  }

  const sql = getDb();
  return sql.begin(async (tx): Promise<ClinicDeleteResult> => {
    await tx`select id from public.clinics where id = ${clinicId} for update`;

    const preflight = await buildClinicDeletePreflight(clinicId, tx);
    if (!preflight.canDelete || !preflight.summary) {
      throw new ClinicDeleteBlockedError(preflight);
    }

    const existingClinicTables = new Set(await listClinicScopedTables(tx));
    const deletedCounts: ClinicDeleteTableCount[] = [];

    for (const def of CLINIC_DELETE_KNOWN_TABLES) {
      if (!existingClinicTables.has(def.table)) continue;
      const count = await deleteRowsByClinicId(tx, def.table, clinicId);
      deletedCounts.push({ table: def.table, label: def.label, count });
    }

    const clinicRows = await tx<{ id: string }[]>`
      delete from public.clinics
      where id = ${clinicId}
      returning id
    `;
    deletedCounts.push({ table: "clinics", label: "Clinic record", count: clinicRows.length });

    if (clinicRows.length !== 1) {
      throw new Error("clinic delete failed");
    }

    return {
      ok: true,
      canDelete: true,
      blockers: [],
      summary: preflight.summary,
      deletedCounts,
    };
  });
}

async function listClinicScopedTables(q: DbExecutor): Promise<string[]> {
  const rows = await q<{ table_name: string }[]>`
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'clinic_id'
      and t.table_type = 'BASE TABLE'
    order by c.table_name asc
  `;
  return rows.map((row) => row.table_name);
}

async function countKnownTables(
  q: DbExecutor,
  clinicId: string,
  existingClinicTables: Set<string>,
  _opts: CountByTableOptions,
): Promise<ClinicDeleteTableCount[]> {
  const counts: ClinicDeleteTableCount[] = [];
  for (const def of CLINIC_DELETE_KNOWN_TABLES) {
    if (!existingClinicTables.has(def.table)) {
      counts.push({ table: def.table, label: def.label, count: 0 });
      continue;
    }
    counts.push({
      table: def.table,
      label: def.label,
      count: await countRowsByClinicId(q, def.table, clinicId),
    });
  }
  return counts;
}

async function countUnknownLinkedRows(
  q: DbExecutor,
  clinicId: string,
  existingClinicTables: Set<string>,
): Promise<ClinicDeleteTableCount[]> {
  const unknownTables = [...existingClinicTables].filter((table) => !KNOWN_TABLE_NAMES.has(table));
  const rows: ClinicDeleteTableCount[] = [];
  for (const table of unknownTables) {
    const count = await countRowsByClinicId(q, table, clinicId);
    if (count > 0) {
      rows.push({
        table,
        label: `Unrecognized clinic data (${table})`,
        count,
      });
    }
  }

  const foreignKeys = await q<{ table_name: string; column_name: string }[]>`
    select kcu.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
     and kcu.table_schema = tc.table_schema
     and kcu.table_name = tc.table_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = tc.constraint_schema
     and ccu.constraint_name = tc.constraint_name
    where tc.table_schema = 'public'
      and tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_schema = 'public'
      and ccu.table_name = 'clinics'
      and ccu.column_name = 'id'
  `;

  for (const fk of foreignKeys) {
    if (KNOWN_TABLE_NAMES.has(fk.table_name) && fk.column_name === "clinic_id") continue;
    if (fk.column_name === "clinic_id" && existingClinicTables.has(fk.table_name)) continue;
    const count = await countRowsByColumn(q, fk.table_name, fk.column_name, clinicId);
    if (count > 0) {
      rows.push({
        table: fk.table_name,
        label: `Unrecognized clinic link (${fk.table_name}.${fk.column_name})`,
        count,
      });
    }
  }

  return dedupeCounts(rows);
}

function dedupeCounts(rows: ClinicDeleteTableCount[]): ClinicDeleteTableCount[] {
  const seen = new Set<string>();
  const out: ClinicDeleteTableCount[] = [];
  for (const row of rows) {
    const key = `${row.table}:${row.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function readPhoneSafety(
  q: DbExecutor,
  clinicId: string,
  existingClinicTables: Set<string>,
): Promise<PhoneSafetyRow> {
  if (!existingClinicTables.has("clinic_phone_numbers")) {
    return { assigned_count: 0, active_count: 0, provider_linked_count: 0 };
  }
  const rows = await q<PhoneSafetyRow[]>`
    select
      count(*) filter (
        where removal_status not in ('detached', 'permanently_removed')
      )::int as assigned_count,
      count(*) filter (
        where is_active = true and removal_status = 'active'
      )::int as active_count,
      count(*) filter (
        where twilio_phone_number_sid is not null
           or twilio_purchased_at is not null
           or twilio_release_status in ('pending', 'failed')
      )::int as provider_linked_count
    from public.clinic_phone_numbers
    where clinic_id = ${clinicId}
  `;
  return rows[0] ?? { assigned_count: 0, active_count: 0, provider_linked_count: 0 };
}

async function countProviderLinkedPurchaseAttempts(
  q: DbExecutor,
  clinicId: string,
  existingClinicTables: Set<string>,
): Promise<number> {
  if (!existingClinicTables.has("clinic_phone_number_purchase_attempts")) return 0;
  const rows = await q<{ n: number }[]>`
    select count(*)::int as n
    from public.clinic_phone_number_purchase_attempts
    where clinic_id = ${clinicId}
      and (
        status in ('started', 'twilio_purchased', 'billing_pending', 'assigned', 'reconciliation_required')
        or twilio_phone_number_sid is not null
        or stripe_subscription_id is not null
      )
  `;
  return rows[0]?.n ?? 0;
}

async function countProviderLinkedA2pSubmissions(
  q: DbExecutor,
  clinicId: string,
  existingClinicTables: Set<string>,
): Promise<number> {
  if (!existingClinicTables.has("clinic_a2p_submissions")) return 0;
  const rows = await q<{ n: number }[]>`
    select count(*)::int as n
    from public.clinic_a2p_submissions
    where clinic_id = ${clinicId}
      and (
        submission_mode in ('mock', 'live')
        or status in ('submitted', 'pending', 'approved')
        or twilio_customer_profile_sid is not null
        or twilio_secondary_customer_profile_sid is not null
        or twilio_trust_product_sid is not null
        or twilio_brand_registration_sid is not null
        or twilio_campaign_sid is not null
        or twilio_messaging_service_sid is not null
        or provider_state <> '{}'::jsonb
      )
  `;
  return rows[0]?.n ?? 0;
}

async function countRowsByClinicId(
  q: DbExecutor,
  table: string,
  clinicId: string,
): Promise<number> {
  const rows = await q.unsafe<{ n: number }[]>(
    `select count(*)::int as n from public.${quoteIdent(table)} where clinic_id = $1`,
    [clinicId],
  );
  return rows[0]?.n ?? 0;
}

async function countRowsByColumn(
  q: DbExecutor,
  table: string,
  column: string,
  clinicId: string,
): Promise<number> {
  const rows = await q.unsafe<{ n: number }[]>(
    `select count(*)::int as n from public.${quoteIdent(table)} where ${quoteIdent(column)} = $1`,
    [clinicId],
  );
  return rows[0]?.n ?? 0;
}

async function deleteRowsByClinicId(
  q: DbExecutor,
  table: string,
  clinicId: string,
): Promise<number> {
  const rows = await q.unsafe<{ one: number }[]>(
    `delete from public.${quoteIdent(table)} where clinic_id = $1 returning 1 as one`,
    [clinicId],
  );
  return rows.length;
}

function quoteIdent(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error("unsafe identifier");
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function tableLabel(table: string): string {
  return TABLE_LABELS.get(table) ?? table;
}
