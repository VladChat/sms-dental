import { NextResponse, type NextRequest } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../lib/http/responses";
import { requireOwnerAdminAccess } from "../../../../lib/auth/owner-admin";
import {
  NotificationPreferencesUnavailableError,
  listClinicNotificationPreferences,
  upsertClinicNotificationPreferences,
} from "../../../../lib/db/notifications";
import {
  isKnownNotificationType,
  type NotificationType,
} from "../../../../config/notifications.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRONT_DESK_MESSAGE = "Front desk users cannot manage notification settings.";

// Account notification settings — owner/admin API (foundation only).
//
// GET returns the clinic's current preferences (config defaults merged with
// saved rows). POST saves only known notification types with boolean enabled
// values and returns the normalized saved preferences. clinic_id always comes
// from the authenticated owner/admin session — never the client. Nothing here
// sends email/SMS, runs jobs, meters AI minutes, or changes billing.

export async function GET(): Promise<NextResponse> {
  const result = await requireOwnerAdminAccess(FRONT_DESK_MESSAGE);
  if (!result.allowed) return result.response;

  const preferences = await listClinicNotificationPreferences(result.access.clinic.id);
  return jsonOk({ ok: true, preferences });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await requireOwnerAdminAccess(FRONT_DESK_MESSAGE);
  if (!result.allowed) return result.response;
  const { access } = result;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const raw = input.preferences;
  if (!Array.isArray(raw)) {
    return jsonBadRequest("Provide a list of notification preferences to save.");
  }

  const preferences: Partial<Record<NotificationType, boolean>> = {};
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      return jsonBadRequest("Each notification preference must include a type and enabled flag.");
    }
    const { notification_type, enabled } = item as Record<string, unknown>;
    if (!isKnownNotificationType(notification_type)) {
      return jsonBadRequest("Unknown notification type.");
    }
    if (typeof enabled !== "boolean") {
      return jsonBadRequest("Each notification preference must be on or off.");
    }
    preferences[notification_type] = enabled;
  }

  if (Object.keys(preferences).length === 0) {
    return jsonBadRequest("Nothing to save yet.");
  }

  try {
    const saved = await upsertClinicNotificationPreferences(
      access.clinic.id,
      preferences,
      access.userId,
    );
    return jsonOk({ ok: true, preferences: saved });
  } catch (err) {
    if (err instanceof NotificationPreferencesUnavailableError) {
      return jsonError(
        503,
        "notifications_unavailable",
        "Notification settings aren’t available yet. Please try again later.",
      );
    }
    return jsonError(
      500,
      "save_failed",
      "We couldn’t save your notification settings. Please try again.",
    );
  }
}
