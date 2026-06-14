import { getDb } from "./client";
import {
  defaultNotificationPreferences,
  isKnownNotificationType,
  type NotificationType,
} from "../../config/notifications.config";

// Clinic-scoped account notification settings (foundation only).
//
// v1 stores which account notifications an owner/admin wants to receive
// (clinic_notification_preferences). A missing row means "use the config
// default", so the read path never depends on rows existing and never crashes
// when the migration has not been applied yet. Nothing here sends email/SMS,
// runs jobs, meters AI minutes, or changes billing.

// Every known notification type → enabled. Always complete (config defaults
// fill any type the clinic has not saved).
export type NotificationPreferenceState = Record<NotificationType, boolean>;

// postgres.js sets `.code` to the Postgres SQLSTATE. 42P01 = undefined_table:
// the notifications migration has not been applied to this database yet.
function isUndefinedTableError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "42P01"
  );
}

// Thrown by the save path only, so the API can return a clear, safe message
// (instead of a generic 500) when the notifications table does not exist yet.
export class NotificationPreferencesUnavailableError extends Error {
  constructor() {
    super("Notification settings are not available yet.");
    this.name = "NotificationPreferencesUnavailableError";
  }
}

// Read path — degradation-safe. Returns the config defaults (currently all
// enabled) when the table is missing OR on any read error, so /account never
// crashes. Saved rows override the defaults; unknown stored types are ignored.
export async function listClinicNotificationPreferences(
  clinicId: string,
): Promise<NotificationPreferenceState> {
  const prefs = defaultNotificationPreferences();
  try {
    const sql = getDb();
    const rows = await sql<{ notification_type: string; enabled: boolean }[]>`
      select notification_type, enabled
      from public.clinic_notification_preferences
      where clinic_id = ${clinicId}
    `;
    for (const row of rows) {
      if (isKnownNotificationType(row.notification_type)) {
        prefs[row.notification_type] = row.enabled;
      }
    }
  } catch {
    // Missing table (pre-migration) or any read error → safe enabled defaults.
  }
  return prefs;
}

// Save path — upserts only known notification types. clinic_id always comes from
// the authenticated owner/admin session (never the client). Returns the
// normalized, merged-over-defaults map so the client always gets every known
// type back. Throws NotificationPreferencesUnavailableError when the table is
// missing so the API can surface a clear message.
export async function upsertClinicNotificationPreferences(
  clinicId: string,
  preferences: Partial<Record<NotificationType, boolean>>,
  actorProfileId: string | null,
): Promise<NotificationPreferenceState> {
  const entries = Object.entries(preferences).filter(([type]) =>
    isKnownNotificationType(type),
  ) as [NotificationType, boolean][];

  if (entries.length > 0) {
    const sql = getDb();
    try {
      await sql.begin(async (tx) => {
        for (const [type, enabled] of entries) {
          await tx`
            insert into public.clinic_notification_preferences (
              clinic_id, notification_type, enabled, updated_by_profile_id
            ) values (
              ${clinicId}, ${type}, ${enabled}, ${actorProfileId}
            )
            on conflict (clinic_id, notification_type) do update set
              enabled = excluded.enabled,
              updated_by_profile_id = excluded.updated_by_profile_id
          `;
        }
      });
    } catch (err) {
      if (isUndefinedTableError(err)) throw new NotificationPreferencesUnavailableError();
      throw err;
    }
  }

  return listClinicNotificationPreferences(clinicId);
}

// Future internal-notification record (not used in this milestone). Idempotent
// on (clinic_id, notification_type, dedupe_key), so a later evaluation job can
// safely retry. Keep payloads free of PHI / patient conversations.
export async function createClinicNotification(input: {
  clinicId: string;
  notificationType: NotificationType;
  dedupeKey: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const sql = getDb();
  const payloadJson = JSON.stringify(input.payload ?? {});
  await sql`
    insert into public.clinic_notifications (
      clinic_id, notification_type, dedupe_key, title, body, payload
    ) values (
      ${input.clinicId}, ${input.notificationType}, ${input.dedupeKey},
      ${input.title}, ${input.body}, ${payloadJson}::jsonb
    )
    on conflict (clinic_id, notification_type, dedupe_key) do nothing
  `;
}
