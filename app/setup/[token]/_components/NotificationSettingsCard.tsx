"use client";

import { useState } from "react";
import {
  NOTIFICATION_GROUPS,
  NOTIFICATION_TYPES,
  includedAiAnsweredMinutesLabel,
  type NotificationType,
} from "../../../../config/notifications.config";
import type { NotificationSettingsData } from "./account-types";

// Notification Settings — v1 foundation. Owners/admins choose which account
// notifications they want to receive. This is settings only: there is no
// delivery channel here (no email, no SMS, no jobs) and no usage evaluation.
//
// Defaults come from config (currently all enabled); a clinic's saved choices
// override them. Saving posts every known type and adopts the server's
// normalized response. No "mandatory" / "cannot disable" concept exists.

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function NotificationSettingsCard({
  initialPreferences,
}: {
  initialPreferences: NotificationSettingsData;
}) {
  const [prefs, setPrefs] = useState<Record<NotificationType, boolean>>(() => ({
    ...initialPreferences,
  }));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  function toggle(type: NotificationType, enabled: boolean) {
    setPrefs((prev) => ({ ...prev, [type]: enabled }));
    setStatus("idle");
    setError(null);
  }

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/account/notification-settings", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          preferences: NOTIFICATION_TYPES.map((t) => ({
            notification_type: t.type,
            enabled: prefs[t.type] ?? t.defaultEnabled,
          })),
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; preferences?: Record<string, boolean>; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok || !json.preferences) {
        setStatus("error");
        setError(json?.error?.message ?? "Could not save your notification settings. Please try again.");
        return;
      }
      // Adopt the server's normalized saved state.
      const saved = json.preferences;
      setPrefs((prev) => {
        const next = { ...prev };
        for (const t of NOTIFICATION_TYPES) {
          if (typeof saved[t.type] === "boolean") next[t.type] = saved[t.type];
        }
        return next;
      });
      setStatus("saved");
    } catch {
      setStatus("error");
      setError("Could not save your notification settings. Please try again.");
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <p className="t-small">
        Choose which account notifications you want to receive. Delivery channels
        will be added later.
      </p>

      {NOTIFICATION_GROUPS.map((group) => {
        const items = NOTIFICATION_TYPES.filter((t) => t.group === group.id);
        if (items.length === 0) return null;
        return (
          <fieldset key={group.id} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <legend className="t-label" style={{ padding: 0 }}>{group.title}</legend>
            <p className="t-small" style={{ marginTop: "var(--space-1)" }}>{group.description}</p>
            {group.id === "ai_answered_call_minutes" && (
              <p className="t-small" style={{ marginTop: "var(--space-1)", color: "var(--text-secondary)" }}>
                Your plan includes {includedAiAnsweredMinutesLabel()} AI answered call minutes.
              </p>
            )}
            <div style={{ display: "grid", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
              {items.map((t) => (
                <label key={t.type} className="check">
                  <input
                    type="checkbox"
                    checked={prefs[t.type] ?? t.defaultEnabled}
                    onChange={(e) => toggle(t.type, e.target.checked)}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}

      {error && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save notification settings"}
        </button>
        {status === "saved" && !error && (
          <span role="status" aria-live="polite" className="t-small" style={{ color: "var(--success-text)" }}>
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
