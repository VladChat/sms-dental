import { getDb } from "./client";

// Readiness is intentionally strict. Missing rows, stale rows, unknown/pending
// statuses, provider errors, or inconsistent number coverage all block live SMS.

export const SMS_READINESS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type SmsReadinessSource = "read_only_sync" | "manual" | "documented";
export type MessagingServiceStatus = "unknown" | "missing" | "verified" | "error";
export type A2pStatus = "unknown" | "pending" | "verified" | "failed" | "rejected" | "blocked";
export type NumberCoverageStatus = "unknown" | "covered" | "missing" | "error";

export type ActiveSmsNumberRow = {
  id: string;
  clinic_id: string;
  phone_number: string;
  twilio_phone_number_sid: string | null;
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
    select id, clinic_id, phone_number, twilio_phone_number_sid
    from public.clinic_phone_numbers
    where clinic_id = ${clinicId}
      and is_active = true
    order by created_at asc
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
      await tx`
        insert into public.clinic_sms_number_readiness
          (clinic_id, clinic_phone_number_id, phone_number,
           twilio_phone_number_sid, twilio_messaging_service_sid,
           messaging_service_sender_status, a2p_campaign_coverage_status,
           production_safe, launch_blocking_reason, status_source,
           last_synced_at, last_sync_error_code, last_sync_error_message)
        values
          (${input.clinicId}, ${n.clinicPhoneNumberId}, ${n.phoneNumber},
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
): Promise<{ ok: boolean; reason: string }> {
  try {
    const summary = await getSmsReadinessSummary(clinicId);
    if (!summary.launchReady) {
      return { ok: false, reason: summary.blockingReason ?? "sms_readiness_blocked" };
    }
    const number = summary.numbers.find((n) => n.phoneNumber === twilioPhone);
    if (!number) return { ok: false, reason: "number_readiness_missing" };
    const numberReason = blockingReasonForNumber(number);
    if (numberReason) return { ok: false, reason: numberReason };
    return { ok: true, reason: "verified" };
  } catch {
    return { ok: false, reason: "sms_readiness_check_failed" };
  }
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
  if (!isFresh(number.lastSyncedAt)) return "number_sms_readiness_stale";
  if (number.lastSyncErrorCode) return "number_sms_readiness_sync_error";
  if (number.messagingServiceSenderStatus !== "covered") return "number_not_in_messaging_service";
  if (number.a2pCampaignCoverageStatus !== "covered") return "number_not_campaign_covered";
  if (!number.productionSafe) {
    return number.launchBlockingReason ?? "number_sms_readiness_not_production_safe";
  }
  return null;
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
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && Date.now() - t <= SMS_READINESS_MAX_AGE_MS;
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
