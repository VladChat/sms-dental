import { getDb } from "./client";
import type { AutomationVolumeSettings } from "../sms-recovery/automation-volume-limits";

// Find or create the conversation thread for a (clinic, patient) pair.
// Uses the unique index on (clinic_id, patient_phone) for idempotency.
export async function getOrCreateConversation(
  clinicId: string,
  patientPhone: string,
): Promise<{ id: string; created: boolean }> {
  const sql = getDb();
  const rows = await sql<{ id: string; inserted: boolean }[]>`
    with ins as (
      insert into public.patient_conversations (clinic_id, patient_phone)
      values (${clinicId}, ${patientPhone})
      on conflict (clinic_id, patient_phone) do nothing
      returning id
    )
    select id, true as inserted from ins
    union all
    select id, false as inserted from public.patient_conversations
    where clinic_id   = ${clinicId}
      and patient_phone = ${patientPhone}
      and not exists (select 1 from ins)
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("patient_conversations get-or-create returned no row");
  return { id: row.id, created: row.inserted };
}

export async function touchConversation(conversationId: string): Promise<void> {
  const sql = getDb();
  await sql`
    update public.patient_conversations
    set last_message_at = now(),
        updated_at      = now()
    where id = ${conversationId}
  `;
}

export type ResetConversationAutoReplyCycleOptions = {
  resetPatientDisplayNameForTest?: boolean;
};

// Start a fresh deterministic auto-reply cycle after a new missed-call
// recovery SMS is accepted and recorded. Keep the safely collected display name
// for real callers; configured internal duplicate-bypass test callers can opt
// into a clean name state for repeat live-test cycles.
//
// Anti-spam volume state: the per-cycle unanswered count, high-volume flag,
// and an EXPIRED mute are cleared — but an ACTIVE mute is never cleared or
// shortened here, so a new recovery SMS cannot re-enable automation early.
export async function resetConversationAutoReplyCycle(
  conversationId: string,
  options: ResetConversationAutoReplyCycleOptions = {},
): Promise<void> {
  const sql = getDb();
  const resetPatientDisplayName = options.resetPatientDisplayNameForTest === true;
  await sql`
    update public.patient_conversations
    set sms_auto_reply_count = 0,
        sms_auto_reply_last_sent_at = null,
        sms_thanks_courtesy_sent_at = null,
        sms_safety_notice_sent_at = null,
        unanswered_after_automation_count = case
          when automation_muted_until is not null and automation_muted_until > now()
            then unanswered_after_automation_count
          else 0
        end,
        high_volume_flagged_at = case
          when automation_muted_until is not null and automation_muted_until > now()
            then high_volume_flagged_at
          else null
        end,
        automation_muted_until = case
          when automation_muted_until is not null and automation_muted_until > now()
            then automation_muted_until
          else null
        end,
        patient_display_name = case
          when ${resetPatientDisplayName} then null
          else patient_display_name
        end,
        updated_at = now()
    where id = ${conversationId}
  `;
}

export type ConversationAutoReplyState = {
  patientDisplayName: string | null;
  smsAutoReplyCount: number;
  smsThanksCourtesySentAt: string | null;
  smsSafetyNoticeSentAt: string | null;
  unansweredAfterAutomationCount: number;
  automationMutedUntil: string | null;
  highVolumeFlaggedAt: string | null;
};

// Read the conversation state the auto-reply decision needs.
export async function getConversationAutoReplyState(
  conversationId: string,
): Promise<ConversationAutoReplyState | null> {
  const sql = getDb();
  const rows = await sql<{
    patient_display_name: string | null;
    sms_auto_reply_count: number;
    sms_thanks_courtesy_sent_at: string | null;
    sms_safety_notice_sent_at: string | null;
    unanswered_after_automation_count: number;
    automation_muted_until: string | null;
    high_volume_flagged_at: string | null;
  }[]>`
    select patient_display_name, sms_auto_reply_count, sms_thanks_courtesy_sent_at,
           sms_safety_notice_sent_at, unanswered_after_automation_count,
           automation_muted_until, high_volume_flagged_at
    from public.patient_conversations
    where id = ${conversationId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    patientDisplayName: row.patient_display_name,
    smsAutoReplyCount: row.sms_auto_reply_count ?? 0,
    smsThanksCourtesySentAt: row.sms_thanks_courtesy_sent_at,
    smsSafetyNoticeSentAt: row.sms_safety_notice_sent_at,
    unansweredAfterAutomationCount: row.unanswered_after_automation_count ?? 0,
    automationMutedUntil: row.automation_muted_until,
    highVolumeFlaggedAt: row.high_volume_flagged_at,
  };
}

// Store a safely-extracted patient display name ONLY when none is set yet.
// Never overwrites an existing name. Returns the stored name, or null when
// nothing was written (already set, or input empty).
export async function setPatientDisplayNameIfEmpty(
  conversationId: string,
  displayName: string,
): Promise<string | null> {
  const name = displayName.trim();
  if (name.length === 0 || name.length > 80) return null;
  const sql = getDb();
  const rows = await sql<{ patient_display_name: string | null }[]>`
    update public.patient_conversations
    set patient_display_name = ${name},
        updated_at = now()
    where id = ${conversationId}
      and (patient_display_name is null or patient_display_name = '')
    returning patient_display_name
  `;
  return rows[0]?.patient_display_name ?? null;
}

// Atomically claim the next auto-reply slot. Uses an optimistic compare on the
// current count so concurrent webhook deliveries (or retries) can never claim
// the same slot twice. Returns the claimed sequence (the new count) or null
// when the expected count no longer matches (already advanced).
export async function claimAutoReplySlot(
  conversationId: string,
  expectedCount: number,
): Promise<number | null> {
  return claimAutoReplySequence(conversationId, expectedCount, expectedCount + 1);
}

// Atomically claim a specific auto-reply sequence. This is used when sequence 1
// is skipped because a patient name is already known and the flow sends
// sequence 2 as the first automated follow-up.
export async function claimAutoReplySequence(
  conversationId: string,
  expectedCount: number,
  sequence: number,
): Promise<number | null> {
  if (!Number.isInteger(sequence) || sequence <= expectedCount) return null;
  const sql = getDb();
  const rows = await sql<{ sms_auto_reply_count: number }[]>`
    update public.patient_conversations
    set sms_auto_reply_count = ${sequence},
        sms_auto_reply_last_sent_at = now(),
        updated_at = now()
    where id = ${conversationId}
      and sms_auto_reply_count = ${expectedCount}
    returning sms_auto_reply_count
  `;
  return rows[0]?.sms_auto_reply_count ?? null;
}

// Atomically claim the one allowed thanks-courtesy reply for the current
// recovery cycle. Returns false when another webhook/retry already claimed it.
export async function claimThanksCourtesyReply(conversationId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    update public.patient_conversations
    set sms_thanks_courtesy_sent_at = now(),
        updated_at = now()
    where id = ${conversationId}
      and sms_thanks_courtesy_sent_at is null
    returning id
  `;
  return rows.length > 0;
}

// Atomically claim the one allowed safety-notice prefix for the current
// recovery cycle. Returns false when it was already claimed — the normal
// follow-up then sends without the 911 line. Intentionally never rolled back
// after a failed Twilio send (idempotent anti-spam behavior).
export async function claimSafetyNotice(conversationId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    update public.patient_conversations
    set sms_safety_notice_sent_at = now(),
        updated_at = now()
    where id = ${conversationId}
      and sms_safety_notice_sent_at is null
    returning id
  `;
  return rows.length > 0;
}

export type UnansweredInboundRecordResult = {
  unansweredAfterAutomationCount: number;
  automationMutedUntil: string | null;
  highVolumeFlaggedAt: string | null;
};

// Count one ordinary inbound SMS that received no automated response because
// automation has ended for this recovery cycle (or is muted). Atomically:
//   - increments unanswered_after_automation_count;
//   - arms automation_muted_until = now() + mute hours when the count reaches
//     the mute threshold and no mute is currently active (an active mute is
//     never extended or shortened mid-window; an expired one re-arms);
//   - stamps high_volume_flagged_at once when the count reaches the
//     high-volume threshold.
// Inbound messages themselves are always recorded elsewhere — this never
// blocks the webhook or the phone number.
export async function recordUnansweredInboundAfterAutomation(
  conversationId: string,
  settings: AutomationVolumeSettings,
): Promise<UnansweredInboundRecordResult | null> {
  const sql = getDb();
  const muteInterval = `${settings.automationMuteHours} hours`;
  const rows = await sql<{
    unanswered_after_automation_count: number;
    automation_muted_until: string | null;
    high_volume_flagged_at: string | null;
  }[]>`
    update public.patient_conversations
    set unanswered_after_automation_count = unanswered_after_automation_count + 1,
        automation_muted_until = case
          when unanswered_after_automation_count + 1 >= ${settings.unansweredMuteAfter}
               and (automation_muted_until is null or automation_muted_until <= now())
            then now() + ${muteInterval}::interval
          else automation_muted_until
        end,
        high_volume_flagged_at = case
          when unanswered_after_automation_count + 1 >= ${settings.unansweredHighVolumeAfter}
               and high_volume_flagged_at is null
            then now()
          else high_volume_flagged_at
        end,
        updated_at = now()
    where id = ${conversationId}
    returning unanswered_after_automation_count, automation_muted_until, high_volume_flagged_at
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    unansweredAfterAutomationCount: row.unanswered_after_automation_count,
    automationMutedUntil: row.automation_muted_until,
    highVolumeFlaggedAt: row.high_volume_flagged_at,
  };
}
