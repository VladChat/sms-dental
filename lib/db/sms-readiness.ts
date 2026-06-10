import { getDb } from "./client";
import { isPhoneNumberRoutableForTexting } from "../texting-status/status-mapping";
import {
  SMS_READINESS_MAX_AGE_MS,
  blockingReasonForLocalNumberReadiness,
  blockingReasonForTollfreeCoverage,
  isReadinessTimestampFresh,
} from "../sms-recovery/live-send-evaluation";

// Readiness is intentionally strict. Missing rows, stale rows, unknown/pending
// statuses, provider errors, or inconsistent number coverage all block live SMS.

export { SMS_READINESS_MAX_AGE_MS };

export type SmsReadinessSource = "read_only_sync" | "manual" | "documented";
export type MessagingServiceStatus = "unknown" | "missing" | "verified" | "error";
export type A2pStatus = "unknown" | "pending" | "verified" | "failed" | "rejected" | "blocked";
export type NumberCoverageStatus = "unknown" | "covered" | "missing" | "error";

export type ActiveSmsNumberRow = {
  id: string;
  clinic_id: string;
  phone_number: string;
  twilio_phone_number_sid: string | null;
  // 'toll_free' | 'local'. A2P 10DLC applies to LOCAL numbers only; toll-free
  // numbers use toll-free verification and must be excluded from A2P packages.
  number_type: "toll_free" | "local";
};

type LiveSendPhoneNumberRow = ActiveSmsNumberRow & {
  is_active: boolean;
  removal_status: string;
  texting_status: string;
};

export type ClinicSmsReadiness = {
  clinicId: string;
  messagingServiceSid: string | null;
  messagingServiceStatus: MessagingServiceStatus;
  brandSid: string | null;
  brandStatus: string;
  campaignSid: string | null;
  campaignStatus: string;
  campaignUsecase: string | null;
  a2pStatus: A2pStatus;
  productionSafe: boolean;
  launchBlockingReason: string | null;
  statusSource: SmsReadinessSource;
  lastSyncedAt: string | null;
  lastSyncErrorCode: string | null;
  lastSyncErrorMessage: string | null;
};

export type NumberSmsReadiness = {
  clinicPhoneNumberId: string;
  phoneNumber: string;
  twilioPhoneNumberSid: string | null;
  messagingServiceSid: string | null;
  messagingServiceSenderStatus: NumberCoverageStatus;
  a2pCampaignCoverageStatus: NumberCoverageStatus;
  productionSafe: boolean;
  launchBlockingReason: string | null;
  statusSource: SmsReadinessSource;
  lastSyncedAt: string | null;
  lastSyncErrorCode: string | null;
  lastSyncErrorMessage: string | null;
};

export type SmsReadinessSummary = {
  launchReady: boolean;
  blockingReason: string | null;
  clinic: ClinicSmsReadiness | null;
  numbers: NumberSmsReadiness[];
};

type ClinicReadinessRow = {
  clinic_id: string;
  twilio_messaging_service_sid: string | null;
  messaging_service_status: MessagingServiceStatus;
  twilio_a2p_brand_sid: string | null;
  twilio_a2p_brand_status: string;
  twilio_a2p_campaign_sid: string | null;
  twilio_a2p_campaign_status: string;
  twilio_a2p_campaign_usecase: string | null;
  a2p_status: A2pStatus;
  production_safe: boolean;
  launch_blocking_reason: string | null;
  status_source: SmsReadinessSource;
  last_synced_at: Date | null;
  last_sync_error_code: string | null;
  last_sync_error_message: string | null;
};

type NumberReadinessRow = {
  clinic_phone_number_id: string;
  phone_number: string;
  twilio_phone_number_sid: string | null;
  twilio_messaging_service_sid: string | null;
  messaging_service_sender_status: NumberCoverageStatus;
  a2p_campaign_coverage_status: NumberCoverageStatus;
  production_safe: boolean;
  launch_blocking_reason: string | null;
  status_source: SmsReadinessSource;
  last_synced_at: Date | null;
  last_sync_error_code: string | null;
  last_sync_error_message: string | null;
};

export type ClinicReadinessSyncInput = {
  clinicId: string;
  messagingServiceSid: string;
  messagingServiceStatus: MessagingServiceStatus;
  brandSid: string | null;
  brandStatus: string;
  campaignSid: string | null;
  campaignStatus: string;
  campaignUsecase: string | null;
  a2pStatus: A2pStatus;
  productionSafe: boolean;
  launchBlockingReason: string | null;
  statusSource: SmsReadinessSource;
  lastSyncedAt: Date;
  lastSyncErrorCode?: string | null;
  lastSyncErrorMessage?: string | null;
  numbers: NumberReadinessSyncInput[];
};

export type NumberReadinessSyncInput = {
  clinicPhoneNumberId: string;
  phoneNumber: string;
  twilioPhoneNumberSid: string | null;
  messagingServiceSid: string;
  messagingServiceSenderStatus: NumberCoverageStatus;
  a2pCampaignCoverageStatus: NumberCoverageStatus;
  productionSafe: boolean;
  launchBlockingReason: string | null;
  statusSource: SmsReadinessSource;
  lastSyncedAt: Date;
  lastSyncErrorCode?: string | null;
  lastSyncErrorMessage?: string | null;
};

export async function listActiveSmsNumbersForClinic(
  clinicId: string,
): Promise<ActiveSmsNumberRow[]> {
  const sql = getDb();
  return sql<ActiveSmsNumberRow[]>`
    select id, clinic_id, phone_number, twilio_phone_number_sid, number_type
    from public.clinic_phone_numbers
    where clinic_id = ${clinicId}
      and is_active = true
      and removal_status = 'active'
      and number_type = 'local'
    order by created_at asc
  `;
}

// Single-number readiness upsert. Used by the texting-status sync to record
// Messaging Service sender coverage for TOLL-FREE numbers (the clinic-level
// A2P sync below covers local numbers). Same row shape and conflict key.
export async function upsertNumberSmsReadiness(
  clinicId: string,
  n: NumberReadinessSyncInput,
): Promise<void> {
  const sql = getDb();
  await writeNumberReadinessRow(sql, clinicId, n);
}

type NumberReadinessWriter = ReturnType<typeof getDb>;

async function writeNumberReadinessRow(
  sql: NumberReadinessWriter,
  clinicId: string,
  n: NumberReadinessSyncInput,
): Promise<void> {
  await sql`
    insert into public.clinic_sms_number_readiness
      (clinic_id, clinic_phone_number_id, phone_number,
       twilio_phone_number_sid, twilio_messaging_service_sid,
       messaging_service_sender_status, a2p_campaign_coverage_status,
       production_safe, launch_blocking_reason, status_source,
       last_synced_at, last_sync_error_code, last_sync_error_message)
    values
      (${clinicId}, ${n.clinicPhoneNumberId}, ${n.phoneNumber},
       ${n.twilioPhoneNumberSid}, ${n.messagingServiceSid},
       ${n.messagingServiceSenderStatus}, ${n.a2pCampaignCoverageStatus},
       ${n.productionSafe}, ${n.launchBlockingReason}, ${n.statusSource},
       ${n.lastSyncedAt}, ${n.lastSyncErrorCode ?? null},
       ${n.lastSyncErrorMessage ?? null})
    on conflict (clinic_phone_number_id) do update set
      clinic_id = excluded.clinic_id,
      phone_number = excluded.phone_number,
      twilio_phone_number_sid = excluded.twilio_phone_number_sid,
      twilio_messaging_service_sid = excluded.twilio_messaging_service_sid,
      messaging_service_sender_status = excluded.messaging_service_sender_status,
      a2p_campaign_coverage_status = excluded.a2p_campaign_coverage_status,
      production_safe = excluded.production_safe,
      launch_blocking_reason = excluded.launch_blocking_reason,
      status_source = excluded.status_source,
      last_synced_at = excluded.last_synced_at,
      last_sync_error_code = excluded.last_sync_error_code,
      last_sync_error_message = excluded.last_sync_error_message
  `;
}

export async function upsertSmsReadinessSync(
  input: ClinicReadinessSyncInput,
): Promise<SmsReadinessSummary> {
  const sql = getDb();
  await sql.begin(async (tx) => {
    await tx`
      insert into public.clinic_sms_readiness
        (clinic_id, twilio_messaging_service_sid, messaging_service_status,
         twilio_a2p_brand_sid, twilio_a2p_brand_status,
         twilio_a2p_campaign_sid, twilio_a2p_campaign_status,
         twilio_a2p_campaign_usecase, a2p_status, production_safe,
         launch_blocking_reason, status_source, last_synced_at,
         last_sync_error_code, last_sync_error_message)
      values
        (${input.clinicId}, ${input.messagingServiceSid}, ${input.messagingServiceStatus},
         ${input.brandSid}, ${input.brandStatus},
         ${input.campaignSid}, ${input.campaignStatus},
         ${input.campaignUsecase}, ${input.a2pStatus}, ${input.productionSafe},
         ${input.launchBlockingReason}, ${input.statusSource}, ${input.lastSyncedAt},
         ${input.lastSyncErrorCode ?? null}, ${input.lastSyncErrorMessage ?? null})
      on conflict (clinic_id) do update set
        twilio_messaging_service_sid = excluded.twilio_messaging_service_sid,
        messaging_service_status = excluded.messaging_service_status,
        twilio_a2p_brand_sid = excluded.twilio_a2p_brand_sid,
        twilio_a2p_brand_status = excluded.twilio_a2p_brand_status,
        twilio_a2p_campaign_sid = excluded.twilio_a2p_campaign_sid,
        twilio_a2p_campaign_status = excluded.twilio_a2p_campaign_status,
        twilio_a2p_campaign_usecase = excluded.twilio_a2p_campaign_usecase,
        a2p_status = excluded.a2p_status,
        production_safe = excluded.production_safe,
        launch_blocking_reason = excluded.launch_blocking_reason,
        status_source = excluded.status_source,
        last_synced_at = excluded.last_synced_at,
        last_sync_error_code = excluded.last_sync_error_code,
        last_sync_error_message = excluded.last_sync_error_message
    `;

    for (const n of input.numbers) {
      await writeNumberReadinessRow(
        tx as unknown as NumberReadinessWriter,
        input.clinicId,
        n,
      );
    }
  });

  return getSmsReadinessSummary(input.clinicId);
}

export async function getSmsReadinessSummary(
  clinicId: string,
): Promise<SmsReadinessSummary> {
  const sql = getDb();
  const [clinicRows, numberRows, activeNumbers] = await Promise.all([
    sql<ClinicReadinessRow[]>`
      select clinic_id, twilio_messaging_service_sid, messaging_service_status,
             twilio_a2p_brand_sid, twilio_a2p_brand_status,
             twilio_a2p_campaign_sid, twilio_a2p_campaign_status,
             twilio_a2p_campaign_usecase, a2p_status, production_safe,
             launch_blocking_reason, status_source, last_synced_at,
             last_sync_error_code, last_sync_error_message
      from public.clinic_sms_readiness
      where clinic_id = ${clinicId}
      limit 1
    `,
    sql<NumberReadinessRow[]>`
      select clinic_phone_number_id, phone_number, twilio_phone_number_sid,
             twilio_messaging_service_sid, messaging_service_sender_status,
             a2p_campaign_coverage_status, production_safe,
             launch_blocking_reason, status_source, last_synced_at,
             last_sync_error_code, last_sync_error_message
      from public.clinic_sms_number_readiness
      where clinic_id = ${clinicId}
      order by phone_number asc
    `,
    listActiveSmsNumbersForClinic(clinicId),
  ]);

  const clinic = clinicRows[0] ? mapClinic(clinicRows[0]) : null;
  const numbers = numberRows.map(mapNumber);
  const launch = evaluateSummary(clinic, numbers, activeNumbers);
  return { launchReady: launch.ok, blockingReason: launch.reason, clinic, numbers };
}

// Tri-state availability probe used by the platform-admin A2P review package.
// Distinguishes "readiness tables unreachable" (available=false — e.g. the
// additive migration has not been applied) from "tables present but no rows yet"
// (available=true, summary present with empty/clinic=null data). Never throws.
export async function getSmsReadinessState(
  clinicId: string,
): Promise<{ available: boolean; summary: SmsReadinessSummary | null }> {
  try {
    const summary = await getSmsReadinessSummary(clinicId);
    return { available: true, summary };
  } catch {
    return { available: false, summary: null };
  }
}

export function isReadinessFresh(iso: string | null): boolean {
  return isFresh(iso);
}

export async function evaluateSmsReadinessForLaunch(
  clinicId: string,
): Promise<{ ok: boolean; reason: string; summary: SmsReadinessSummary | null }> {
  try {
    const summary = await getSmsReadinessSummary(clinicId);
    return {
      ok: summary.launchReady,
      reason: summary.blockingReason ?? "verified",
      summary,
    };
  } catch {
    return { ok: false, reason: "sms_readiness_check_failed", summary: null };
  }
}

export async function evaluateSmsReadinessForLiveSend(
  clinicId: string,
  twilioPhone: string,
): Promise<{ ok: boolean; reason: string; numberType?: "toll_free" | "local" }> {
  try {
    const number = await findLiveSendPhoneNumber(clinicId, twilioPhone);
    if (!number) return { ok: false, reason: "phone_number_mapping_missing" };
    if (!number.is_active || number.removal_status !== "active") {
      return { ok: false, reason: "phone_number_not_active", numberType: number.number_type };
    }
    if (!isPhoneNumberRoutableForTexting(number)) {
      return {
        ok: false,
        reason: "phone_number_texting_not_active",
        numberType: number.number_type,
      };
    }
    if (number.number_type === "toll_free") {
      // Toll-free verification is reflected in texting_status (checked above),
      // but the exact number must ALSO be a fresh, verified sender on our
      // Messaging Service. Missing/stale/errored coverage fails closed.
      const readiness = await getNumberSmsReadiness(number.id);
      const coverageReason = blockingReasonForTollfreeCoverage(readiness);
      if (coverageReason) {
        return { ok: false, reason: coverageReason, numberType: "toll_free" };
      }
      return { ok: true, reason: "verified", numberType: "toll_free" };
    }

    const summary = await getSmsReadinessSummary(clinicId);
    if (!summary.launchReady) {
      return {
        ok: false,
        reason: summary.blockingReason ?? "sms_readiness_blocked",
        numberType: "local",
      };
    }
    const readiness = summary.numbers.find((n) => n.phoneNumber === twilioPhone);
    if (!readiness) return { ok: false, reason: "number_readiness_missing", numberType: "local" };
    const numberReason = blockingReasonForNumber(readiness);
    if (numberReason) return { ok: false, reason: numberReason, numberType: "local" };
    return { ok: true, reason: "verified", numberType: "local" };
  } catch {
    return { ok: false, reason: "sms_readiness_check_failed" };
  }
}

export async function evaluateTextingStatusForLaunch(
  clinicId: string,
): Promise<{ ok: boolean; reason: string }> {
  const sql = getDb();
  const activeNumbers = await sql<(LiveSendPhoneNumberRow & { id: string })[]>`
    select id, clinic_id, phone_number, twilio_phone_number_sid, number_type,
           is_active, removal_status, texting_status
    from public.clinic_phone_numbers
    where clinic_id = ${clinicId}
      and is_active = true
      and removal_status = 'active'
    order by created_at asc
  `;
  if (activeNumbers.length === 0) return { ok: false, reason: "no_active_sms_numbers" };
  const notActive = activeNumbers.find((n) => n.texting_status !== "active");
  if (notActive) return { ok: false, reason: `phone_number_texting_not_active:${notActive.phone_number}` };

  // Toll-free numbers must each have fresh Messaging Service sender coverage
  // before the clinic can be launched. (Local numbers are covered by the A2P
  // readiness summary below.)
  for (const n of activeNumbers) {
    if (n.number_type !== "toll_free") continue;
    let readiness: NumberSmsReadiness | null;
    try {
      readiness = await getNumberSmsReadiness(n.id);
    } catch {
      return { ok: false, reason: "sms_readiness_check_failed" };
    }
    const coverageReason = blockingReasonForTollfreeCoverage(readiness);
    if (coverageReason) {
      return { ok: false, reason: `${coverageReason}:${n.phone_number}` };
    }
  }

  if (!activeNumbers.some((n) => n.number_type === "local")) {
    return { ok: true, reason: "verified" };
  }
  return evaluateSmsReadinessForLaunch(clinicId);
}

// Per-number readiness row lookup (exact clinic_phone_numbers id). Returns null
// when no readiness row has been recorded yet — callers fail closed on null.
export async function getNumberSmsReadiness(
  clinicPhoneNumberId: string,
): Promise<NumberSmsReadiness | null> {
  const sql = getDb();
  const rows = await sql<NumberReadinessRow[]>`
    select clinic_phone_number_id, phone_number, twilio_phone_number_sid,
           twilio_messaging_service_sid, messaging_service_sender_status,
           a2p_campaign_coverage_status, production_safe,
           launch_blocking_reason, status_source, last_synced_at,
           last_sync_error_code, last_sync_error_message
    from public.clinic_sms_number_readiness
    where clinic_phone_number_id = ${clinicPhoneNumberId}
    limit 1
  `;
  return rows[0] ? mapNumber(rows[0]) : null;
}

function evaluateSummary(
  clinic: ClinicSmsReadiness | null,
  numbers: NumberSmsReadiness[],
  activeNumbers: ActiveSmsNumberRow[],
): { ok: boolean; reason: string } {
  if (!clinic) return { ok: false, reason: "clinic_sms_readiness_missing" };
  const clinicReason = blockingReasonForClinic(clinic);
  if (clinicReason) return { ok: false, reason: clinicReason };
  if (activeNumbers.length === 0) return { ok: false, reason: "no_active_sms_numbers" };

  for (const active of activeNumbers) {
    const readiness = numbers.find((n) => n.clinicPhoneNumberId === active.id);
    if (!readiness) return { ok: false, reason: `number_readiness_missing:${active.phone_number}` };
    const numberReason = blockingReasonForNumber(readiness);
    if (numberReason) return { ok: false, reason: `${numberReason}:${active.phone_number}` };
  }

  return { ok: true, reason: "verified" };
}

async function findLiveSendPhoneNumber(
  clinicId: string,
  twilioPhone: string,
): Promise<LiveSendPhoneNumberRow | null> {
  const sql = getDb();
  const rows = await sql<LiveSendPhoneNumberRow[]>`
    select id, clinic_id, phone_number, twilio_phone_number_sid, number_type,
           is_active, removal_status, texting_status
    from public.clinic_phone_numbers
    where clinic_id = ${clinicId}
      and phone_number = ${twilioPhone}
    limit 1
  `;
  return rows[0] ?? null;
}

function blockingReasonForClinic(clinic: ClinicSmsReadiness): string | null {
  if (!isFresh(clinic.lastSyncedAt)) return "clinic_sms_readiness_stale";
  if (clinic.lastSyncErrorCode) return "clinic_sms_readiness_sync_error";
  if (clinic.messagingServiceStatus !== "verified") return "messaging_service_not_verified";
  if (clinic.a2pStatus !== "verified") return "a2p_not_verified";
  if (!isSafeBrandStatus(clinic.brandStatus)) return "a2p_brand_not_verified";
  if (!isSafeCampaignStatus(clinic.campaignStatus)) return "a2p_campaign_not_verified";
  if (!clinic.productionSafe) {
    return clinic.launchBlockingReason ?? "clinic_sms_readiness_not_production_safe";
  }
  return null;
}

function blockingReasonForNumber(number: NumberSmsReadiness): string | null {
  return blockingReasonForLocalNumberReadiness(number);
}

export function normalizeProviderStatus(value: string | null | undefined): string {
  const v = (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return v.length > 0 ? v : "unknown";
}

export function isSafeBrandStatus(status: string | null | undefined): boolean {
  const normalized = normalizeProviderStatus(status);
  return normalized === "approved" || normalized === "verified" || normalized === "registered";
}

export function isSafeCampaignStatus(status: string | null | undefined): boolean {
  const normalized = normalizeProviderStatus(status);
  return normalized === "approved" || normalized === "verified";
}

function isFresh(iso: string | null): boolean {
  return isReadinessTimestampFresh(iso);
}

function mapClinic(row: ClinicReadinessRow): ClinicSmsReadiness {
  return {
    clinicId: row.clinic_id,
    messagingServiceSid: row.twilio_messaging_service_sid,
    messagingServiceStatus: row.messaging_service_status,
    brandSid: row.twilio_a2p_brand_sid,
    brandStatus: row.twilio_a2p_brand_status,
    campaignSid: row.twilio_a2p_campaign_sid,
    campaignStatus: row.twilio_a2p_campaign_status,
    campaignUsecase: row.twilio_a2p_campaign_usecase,
    a2pStatus: row.a2p_status,
    productionSafe: row.production_safe,
    launchBlockingReason: row.launch_blocking_reason,
    statusSource: row.status_source,
    lastSyncedAt: row.last_synced_at ? row.last_synced_at.toISOString() : null,
    lastSyncErrorCode: row.last_sync_error_code,
    lastSyncErrorMessage: row.last_sync_error_message,
  };
}

function mapNumber(row: NumberReadinessRow): NumberSmsReadiness {
  return {
    clinicPhoneNumberId: row.clinic_phone_number_id,
    phoneNumber: row.phone_number,
    twilioPhoneNumberSid: row.twilio_phone_number_sid,
    messagingServiceSid: row.twilio_messaging_service_sid,
    messagingServiceSenderStatus: row.messaging_service_sender_status,
    a2pCampaignCoverageStatus: row.a2p_campaign_coverage_status,
    productionSafe: row.production_safe,
    launchBlockingReason: row.launch_blocking_reason,
    statusSource: row.status_source,
    lastSyncedAt: row.last_synced_at ? row.last_synced_at.toISOString() : null,
    lastSyncErrorCode: row.last_sync_error_code,
    lastSyncErrorMessage: row.last_sync_error_message,
  };
}

// ---------------------------------------------------------------------------
// Operator readiness audit
// ---------------------------------------------------------------------------
// One row per assigned (not permanently removed/detached) number, answering:
// can this exact number send a live recovery SMS right now, and if not, what is
// the FIRST blocking reason? Uses the same pure evaluation as the live-send
// guard so the audit can never disagree with enforcement. Read-only.

export type SmsSendReadinessAuditRow = {
  clinicId: string;
  clinicName: string;
  clinicIsActive: boolean;
  smsRecoveryEnabled: boolean;
  clinicSmsStatus: string;
  phoneNumberId: string;
  phoneNumber: string;
  numberType: "toll_free" | "local";
  twilioPhoneNumberSid: string | null;
  numberIsActive: boolean;
  removalStatus: string;
  textingStatus: string;
  textingProviderStatus: string | null;
  textingProviderErrorCode: string | null;
  textingProviderSyncedAt: string | null;
  messagingServiceSenderStatus: NumberCoverageStatus | null;
  a2pCampaignCoverageStatus: NumberCoverageStatus | null;
  readinessLastSyncedAt: string | null;
  readinessErrorCode: string | null;
  // Exact-number readiness only (lifecycle + texting status + coverage/A2P).
  numberReady: boolean;
  // numberReady AND clinic active AND sms_recovery_enabled AND mode === "live".
  // Per-patient guards (opt-out, duplicate suppression) still apply at send time.
  canSendSms: boolean;
  blockingReason: string | null;
};

type AuditNumberRow = {
  clinic_id: string;
  clinic_name: string;
  clinic_is_active: boolean;
  sms_recovery_enabled: boolean;
  clinic_sms_status: string;
  id: string;
  phone_number: string;
  number_type: "toll_free" | "local";
  twilio_phone_number_sid: string | null;
  is_active: boolean;
  removal_status: string;
  texting_status: string;
  texting_provider_status: string | null;
  texting_provider_error_code: string | null;
  texting_provider_synced_at: Date | null;
  r_sender_status: NumberCoverageStatus | null;
  r_campaign_status: NumberCoverageStatus | null;
  r_production_safe: boolean | null;
  r_blocking_reason: string | null;
  r_last_synced_at: Date | null;
  r_error_code: string | null;
};

export async function auditSmsSendReadiness(options?: {
  clinicId?: string | null;
  smsRecoveryMode?: string;
}): Promise<SmsSendReadinessAuditRow[]> {
  const sql = getDb();
  const clinicFilter = options?.clinicId ?? null;
  const mode = options?.smsRecoveryMode ?? "unknown";

  const rows = await sql<AuditNumberRow[]>`
    select
      c.id as clinic_id,
      c.name as clinic_name,
      c.is_active as clinic_is_active,
      c.sms_recovery_enabled,
      c.sms_status as clinic_sms_status,
      cpn.id, cpn.phone_number, cpn.number_type, cpn.twilio_phone_number_sid,
      cpn.is_active, cpn.removal_status, cpn.texting_status,
      cpn.texting_provider_status, cpn.texting_provider_error_code,
      cpn.texting_provider_synced_at,
      r.messaging_service_sender_status as r_sender_status,
      r.a2p_campaign_coverage_status as r_campaign_status,
      r.production_safe as r_production_safe,
      r.launch_blocking_reason as r_blocking_reason,
      r.last_synced_at as r_last_synced_at,
      r.last_sync_error_code as r_error_code
    from public.clinic_phone_numbers cpn
    join public.clinics c on c.id = cpn.clinic_id
    left join public.clinic_sms_number_readiness r
      on r.clinic_phone_number_id = cpn.id
    where cpn.removal_status in ('active', 'scheduled')
      and (${clinicFilter}::uuid is null or cpn.clinic_id = ${clinicFilter}::uuid)
    order by c.name asc, cpn.created_at asc
  `;

  // Clinic-level A2P readiness is only consulted for clinics that have local
  // numbers; load those summaries once per clinic.
  const localClinicIds = [
    ...new Set(rows.filter((r) => r.number_type === "local").map((r) => r.clinic_id)),
  ];
  const clinicReadinessById = new Map<string, ClinicSmsReadiness | null>();
  if (localClinicIds.length > 0) {
    const clinicRows = await sql<ClinicReadinessRow[]>`
      select clinic_id, twilio_messaging_service_sid, messaging_service_status,
             twilio_a2p_brand_sid, twilio_a2p_brand_status,
             twilio_a2p_campaign_sid, twilio_a2p_campaign_status,
             twilio_a2p_campaign_usecase, a2p_status, production_safe,
             launch_blocking_reason, status_source, last_synced_at,
             last_sync_error_code, last_sync_error_message
      from public.clinic_sms_readiness
      where clinic_id = any(${localClinicIds}::uuid[])
    `;
    for (const row of clinicRows) {
      clinicReadinessById.set(row.clinic_id, mapClinic(row));
    }
  }

  return rows.map((row) => {
    const numberReadiness =
      row.r_last_synced_at !== null || row.r_sender_status !== null
        ? {
            messagingServiceSenderStatus: row.r_sender_status ?? "unknown",
            a2pCampaignCoverageStatus: row.r_campaign_status ?? "unknown",
            productionSafe: row.r_production_safe ?? false,
            launchBlockingReason: row.r_blocking_reason,
            lastSyncedAt: row.r_last_synced_at ? row.r_last_synced_at.toISOString() : null,
            lastSyncErrorCode: row.r_error_code,
          }
        : null;

    // Exact-number readiness, mirroring evaluateSmsReadinessForLiveSend.
    let numberReason: string | null = null;
    if (!row.is_active || row.removal_status !== "active") {
      numberReason = "phone_number_not_active";
    } else if (row.texting_status !== "active") {
      numberReason = "phone_number_texting_not_active";
    } else if (row.number_type === "toll_free") {
      numberReason = blockingReasonForTollfreeCoverage(numberReadiness);
    } else {
      const clinicReadiness = clinicReadinessById.get(row.clinic_id) ?? null;
      numberReason = !clinicReadiness
        ? "clinic_sms_readiness_missing"
        : blockingReasonForClinic(clinicReadiness);
      if (!numberReason) {
        numberReason = blockingReasonForLocalNumberReadiness(numberReadiness);
      }
      if (!numberReason && row.clinic_sms_status !== "active") {
        numberReason = "sms_status_not_active";
      }
    }

    // Clinic/runtime gates, in the order an operator should resolve them.
    const blockingReason =
      !row.clinic_is_active
        ? "clinic_not_active"
        : numberReason
          ? numberReason
          : !row.sms_recovery_enabled
            ? "sms_recovery_disabled_for_clinic"
            : mode !== "live"
              ? "sms_recovery_mode_not_live"
              : null;

    return {
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      clinicIsActive: row.clinic_is_active,
      smsRecoveryEnabled: row.sms_recovery_enabled,
      clinicSmsStatus: row.clinic_sms_status,
      phoneNumberId: row.id,
      phoneNumber: row.phone_number,
      numberType: row.number_type,
      twilioPhoneNumberSid: row.twilio_phone_number_sid,
      numberIsActive: row.is_active,
      removalStatus: row.removal_status,
      textingStatus: row.texting_status,
      textingProviderStatus: row.texting_provider_status,
      textingProviderErrorCode: row.texting_provider_error_code,
      textingProviderSyncedAt: row.texting_provider_synced_at
        ? row.texting_provider_synced_at.toISOString()
        : null,
      messagingServiceSenderStatus: row.r_sender_status,
      a2pCampaignCoverageStatus: row.r_campaign_status,
      readinessLastSyncedAt: row.r_last_synced_at ? row.r_last_synced_at.toISOString() : null,
      readinessErrorCode: row.r_error_code,
      numberReady: numberReason === null,
      canSendSms: blockingReason === null,
      blockingReason,
    };
  });
}
