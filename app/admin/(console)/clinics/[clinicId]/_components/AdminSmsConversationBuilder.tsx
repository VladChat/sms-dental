"use client";

import { useEffect, useMemo, useState } from "react";

// Platform-admin-only SMS Conversation Builder. Configures the deterministic
// missed-call recovery SMS flow for ONE clinic. Clinic owners cannot edit this.
// No AI: fixed clinic-identity prefix + "Reply STOP to opt out." suffix are
// always added in code; only the middle text and follow-up bodies are editable.

const SLOTS = [1, 2, 3] as const;
type Slot = (typeof SLOTS)[number];

type FollowUpView = {
  body: string | null;
  enabled: boolean;
  suggestion: string;
  preview: string;
};

type ConfigPayload = {
  clinicName: string;
  config: {
    initialMiddle: string | null;
    defaultInitialMiddle: string;
    maxAutoReplies: number;
    followUps: Record<string, FollowUpView>;
  };
  preview: { initialPrefix: string; initialSuffix: string; initial: string };
  limits?: { maxAutoReplies: number; maxInitialMiddleLength: number; maxTemplateBodyLength: number };
  variables?: string[];
};

type FollowUpState = { body: string; enabled: boolean; suggestion: string };

type LoadState = "loading" | "error" | "ready";

export function AdminSmsConversationBuilder({ clinicId }: { clinicId: string }) {
  const [load, setLoad] = useState<LoadState>("loading");
  const [clinicName, setClinicName] = useState("");
  const [defaultMiddle, setDefaultMiddle] = useState("");
  const [initialMiddle, setInitialMiddle] = useState("");
  const [maxAutoReplies, setMaxAutoReplies] = useState(0);
  const [followUps, setFollowUps] = useState<Record<Slot, FollowUpState>>({
    1: { body: "", enabled: false, suggestion: "" },
    2: { body: "", enabled: false, suggestion: "" },
    3: { body: "", enabled: false, suggestion: "" },
  });
  const [initialPreview, setInitialPreview] = useState("");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("Reply STOP to opt out.");
  const [maxMiddleLen, setMaxMiddleLen] = useState(240);
  const [maxBodyLen, setMaxBodyLen] = useState(240);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function apply(data: ConfigPayload) {
    setClinicName(data.clinicName);
    setDefaultMiddle(data.config.defaultInitialMiddle);
    setInitialMiddle(data.config.initialMiddle ?? "");
    setMaxAutoReplies(data.config.maxAutoReplies);
    const next = { ...followUps };
    for (const slot of SLOTS) {
      const fu = data.config.followUps[String(slot)];
      next[slot] = {
        body: fu?.body ?? "",
        enabled: fu?.enabled ?? false,
        suggestion: fu?.suggestion ?? "",
      };
    }
    setFollowUps(next);
    setInitialPreview(data.preview.initial);
    setPrefix(data.preview.initialPrefix);
    setSuffix(data.preview.initialSuffix);
    if (data.limits) {
      setMaxMiddleLen(data.limits.maxInitialMiddleLength);
      setMaxBodyLen(data.limits.maxTemplateBodyLength);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/clinics/${clinicId}/sms-conversation`, {
          credentials: "include",
        });
        const json = (await res.json().catch(() => null)) as (ConfigPayload & { ok?: boolean }) | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          setLoad("error");
          return;
        }
        apply(json);
        setLoad("ready");
      } catch {
        if (!cancelled) setLoad("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  // Client-side preview of the initial SMS (prefix + middle + suffix). The
  // server is the source of truth on save; this is just immediate feedback.
  const localInitialPreview = useMemo(() => {
    const middle = initialMiddle.trim().length > 0 ? initialMiddle.trim() : defaultMiddle;
    const resolvedPrefix = prefix || `Hi, this is ${clinicName || "your dental office"}.`;
    return `${resolvedPrefix} ${middle} ${suffix}`.replace(/\s+/g, " ").trim();
  }, [initialMiddle, defaultMiddle, prefix, suffix, clinicName]);

  function setFollowUp(slot: Slot, patch: Partial<FollowUpState>) {
    setFollowUps((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));
    setSaved(false);
  }

  function resetInitial() {
    setInitialMiddle("");
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/sms-conversation`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initialMiddle,
          maxAutoReplies,
          followUps: {
            1: { body: followUps[1].body, enabled: followUps[1].enabled },
            2: { body: followUps[2].body, enabled: followUps[2].enabled },
            3: { body: followUps[3].body, enabled: followUps[3].enabled },
          },
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | (ConfigPayload & { ok?: boolean; error?: { message?: string } })
        | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error?.message ?? "Could not save. Please try again.");
        return;
      }
      apply(json);
      setSaved(true);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (load === "loading") {
    return <p className="t-small" role="status" aria-live="polite">Loading…</p>;
  }
  if (load === "error") {
    return (
      <div className="alert alert-error" role="alert">
        <span>We couldn’t load the SMS settings. Please refresh and try again.</span>
      </div>
    );
  }

  // The maximum selectable automated replies = count of leading slots that are
  // enabled and non-empty (1, then 2, then 3 — must be contiguous).
  let contiguousEnabled = 0;
  for (const slot of SLOTS) {
    if (followUps[slot].enabled && followUps[slot].body.trim().length > 0) contiguousEnabled += 1;
    else break;
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <p className="t-helper" style={{ margin: 0, color: "var(--text-muted)" }}>
        Configure the SMS flow for missed-call recovery. Clinic identity and opt-out handling stay
        required. These templates are deterministic — no AI, no patient data stored in the copy.
      </p>

      {/* Variable helper */}
      <section className="adm-section-head" style={{ display: "block" }}>
        <h3 className="adm-subhead">Variables you can use</h3>
        <ul className="t-small" style={{ margin: "var(--space-2) 0 0", paddingLeft: "var(--space-5)" }}>
          <li><code>{"{{clinic_name}}"}</code> — always comes from the clinic profile.</li>
          <li><code>{"{{patient_name}}"}</code> — used only when safely collected from a patient reply.</li>
        </ul>
      </section>

      {/* Initial missed-call SMS */}
      <section style={{ display: "grid", gap: "var(--space-3)" }}>
        <h3 className="adm-subhead">Initial missed-call SMS</h3>
        <div className="adm-locked-line t-small">
          <span style={{ color: "var(--text-muted)" }}>Locked start:</span>{" "}
          <span style={{ fontWeight: 600 }}>{prefix || `Hi, this is ${clinicName}.`}</span>
        </div>
        <div className="field">
          <label htmlFor="aisms-middle">Editable middle text</label>
          <textarea
            id="aisms-middle"
            className="textarea"
            rows={2}
            value={initialMiddle}
            maxLength={maxMiddleLen}
            placeholder={defaultMiddle}
            onChange={(e) => { setInitialMiddle(e.target.value); setSaved(false); }}
          />
          <p className="helper">
            {initialMiddle.length}/{maxMiddleLen} · Leave blank to use the default:{" "}
            <span style={{ fontStyle: "italic" }}>{defaultMiddle}</span>
          </p>
        </div>
        <div className="adm-locked-line t-small">
          <span style={{ color: "var(--text-muted)" }}>Locked end:</span>{" "}
          <span style={{ fontWeight: 600 }}>{suffix}</span>
        </div>
        <PreviewBox label="Preview" text={localInitialPreview || initialPreview} />
        <div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetInitial}>
            Reset to default
          </button>
        </div>
      </section>

      {/* Auto-reply templates */}
      <section style={{ display: "grid", gap: "var(--space-4)" }}>
        <h3 className="adm-subhead">Automated follow-up replies</h3>
        <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
          After a patient replies, the office can send up to three deterministic follow-ups. Each
          sends only when enabled and within the limit below.
        </p>
        {SLOTS.map((slot) => (
          <div
            key={slot}
            style={{
              display: "grid",
              gap: "var(--space-2)",
              padding: "var(--space-4)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              background: "var(--surface-sunken)",
            }}
          >
            <div className="adm-section-head">
              <h4 className="t-small" style={{ fontWeight: 700, margin: 0 }}>
                Follow-up #{slot}
              </h4>
              <label className="check" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={followUps[slot].enabled}
                  onChange={(e) => setFollowUp(slot, { enabled: e.target.checked })}
                />
                <span>Enabled</span>
              </label>
            </div>
            <p className="t-helper" style={{ margin: 0, color: "var(--text-muted)" }}>
              Sends after the {slot === 1 ? "first" : slot === 2 ? "second" : "third"} patient reply.
            </p>
            <textarea
              className="textarea"
              rows={2}
              value={followUps[slot].body}
              maxLength={maxBodyLen}
              placeholder={followUps[slot].suggestion}
              onChange={(e) => setFollowUp(slot, { body: e.target.value })}
            />
            <p className="helper">
              {followUps[slot].body.length}/{maxBodyLen}
              {followUps[slot].suggestion ? (
                <>
                  {" "}· Suggestion:{" "}
                  <button
                    type="button"
                    className="link"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    onClick={() => setFollowUp(slot, { body: followUps[slot].suggestion })}
                  >
                    use “{followUps[slot].suggestion}”
                  </button>
                </>
              ) : null}
            </p>
          </div>
        ))}
      </section>

      {/* Max automated replies */}
      <section className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="aisms-max">Maximum automated replies</label>
        <select
          id="aisms-max"
          className="select"
          value={maxAutoReplies}
          onChange={(e) => { setMaxAutoReplies(Number(e.target.value)); setSaved(false); }}
        >
          {[0, 1, 2, 3].map((n) => (
            <option key={n} value={n} disabled={n > contiguousEnabled}>
              {n}{n > contiguousEnabled ? " (enable follow-ups first)" : ""}
            </option>
          ))}
        </select>
        <p className="helper">
          0 turns off automated follow-ups. The limit can’t exceed the enabled follow-ups in order.
        </p>
      </section>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save SMS settings"}
        </button>
        {saved && !error && (
          <span className="t-small" role="status" aria-live="polite" style={{ color: "var(--success-text)" }}>
            Saved.
          </span>
        )}
      </div>
    </div>
  );
}

function PreviewBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div
        className="t-small"
        style={{
          padding: "var(--space-3) var(--space-4)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          background: "var(--surface)",
          whiteSpace: "pre-wrap",
        }}
      >
        {text || "—"}
      </div>
    </div>
  );
}
