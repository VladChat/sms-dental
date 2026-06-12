"use client";

import { useEffect, useMemo, useState } from "react";

// Platform-admin-only SMS Conversation Builder. Configures the deterministic
// missed-call recovery SMS flow for ONE clinic. Clinic owners cannot edit this.
// No AI: the admin can edit the full initial template, while the server still
// requires clinic identity and "Reply STOP to opt out." language.

const SLOTS = [1, 2, 3] as const;
type Slot = (typeof SLOTS)[number];
const VOICE_SCENARIOS = ["will_send", "duplicate", "none"] as const;
type VoiceScenario = (typeof VOICE_SCENARIOS)[number];

type FollowUpView = {
  body: string | null;
  enabled: boolean;
  suggestion: string;
  preview: string;
};

type VoiceGreetingView = {
  body: string | null;
  defaultText: string;
  suggestion: string;
  preview: string;
  label: string;
  helper: string;
};

type ConfigPayload = {
  clinicName: string;
  config: {
    initialTemplate: string | null;
    defaultInitialTemplate: string;
    initialSuggestion: string;
    maxAutoReplies: number;
    followUps: Record<string, FollowUpView>;
    voiceGreetings: Record<VoiceScenario, VoiceGreetingView>;
  };
  preview: { initial: string; voiceGreetings?: Record<VoiceScenario, string> };
  limits?: {
    maxAutoReplies: number;
    maxInitialTemplateLength: number;
    maxTemplateBodyLength: number;
    maxVoiceGreetingTemplateLength: number;
  };
  variables?: string[];
  voiceVariables?: string[];
};

type FollowUpState = { body: string; enabled: boolean; suggestion: string };
type VoiceGreetingState = {
  body: string;
  defaultText: string;
  suggestion: string;
  preview: string;
  label: string;
  helper: string;
};

type LoadState = "loading" | "error" | "ready";

export function AdminSmsConversationBuilder({ clinicId }: { clinicId: string }) {
  const [load, setLoad] = useState<LoadState>("loading");
  const [clinicName, setClinicName] = useState("");
  const [defaultInitialTemplate, setDefaultInitialTemplate] = useState("");
  const [initialSuggestion, setInitialSuggestion] = useState("");
  const [initialTemplate, setInitialTemplate] = useState("");
  const [maxAutoReplies, setMaxAutoReplies] = useState(0);
  const [followUps, setFollowUps] = useState<Record<Slot, FollowUpState>>({
    1: { body: "", enabled: false, suggestion: "" },
    2: { body: "", enabled: false, suggestion: "" },
    3: { body: "", enabled: false, suggestion: "" },
  });
  const [voiceGreetings, setVoiceGreetings] = useState<Record<VoiceScenario, VoiceGreetingState>>({
    will_send: { body: "", defaultText: "", suggestion: "", preview: "", label: "Will send text", helper: "" },
    duplicate: { body: "", defaultText: "", suggestion: "", preview: "", label: "Duplicate text", helper: "" },
    none: { body: "", defaultText: "", suggestion: "", preview: "", label: "No text", helper: "" },
  });
  const [initialPreview, setInitialPreview] = useState("");
  const [maxInitialLen, setMaxInitialLen] = useState(240);
  const [maxBodyLen, setMaxBodyLen] = useState(240);
  const [maxVoiceLen, setMaxVoiceLen] = useState(240);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function apply(data: ConfigPayload) {
    setClinicName(data.clinicName);
    setDefaultInitialTemplate(data.config.defaultInitialTemplate);
    setInitialSuggestion(data.config.initialSuggestion);
    setInitialTemplate(data.config.initialTemplate ?? data.config.defaultInitialTemplate);
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
    const nextVoice = { ...voiceGreetings };
    for (const scenario of VOICE_SCENARIOS) {
      const vg = data.config.voiceGreetings?.[scenario];
      nextVoice[scenario] = {
        body: vg?.body ?? "",
        defaultText: vg?.defaultText ?? "",
        suggestion: vg?.suggestion ?? vg?.defaultText ?? "",
        preview: vg?.preview ?? "",
        label: vg?.label ?? scenario,
        helper: vg?.helper ?? "",
      };
    }
    setVoiceGreetings(nextVoice);
    setInitialPreview(data.preview.initial);
    if (data.limits) {
      setMaxInitialLen(data.limits.maxInitialTemplateLength);
      setMaxBodyLen(data.limits.maxTemplateBodyLength);
      setMaxVoiceLen(data.limits.maxVoiceGreetingTemplateLength ?? data.limits.maxTemplateBodyLength);
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

  // Client-side preview of the full initial SMS. The server is the source of
  // truth on save; this is just immediate feedback.
  const localInitialPreview = useMemo(() => {
    const source = initialTemplate.trim().length > 0 ? initialTemplate : defaultInitialTemplate;
    return renderLocalPreview(source, clinicName);
  }, [initialTemplate, defaultInitialTemplate, clinicName]);

  const localVoicePreviews = useMemo(() => {
    return Object.fromEntries(
      VOICE_SCENARIOS.map((scenario) => {
        const state = voiceGreetings[scenario];
        const source = state.body.trim().length > 0 ? state.body : state.defaultText;
        return [scenario, renderLocalVoicePreview(source, clinicName)];
      }),
    ) as Record<VoiceScenario, string>;
  }, [voiceGreetings, clinicName]);

  const initialInlineError = useMemo(() => {
    const source = initialTemplate.trim();
    if (!source) return null;
    if (!hasClinicIdentity(source, clinicName)) {
      return "Include the clinic identity with {{clinic_name}}.";
    }
    if (!hasStopOptOut(source)) {
      return "Include “Reply STOP to opt out.”";
    }
    if (/\{\{\s*patient_name\s*\}\}/i.test(source)) {
      return "{{patient_name}} can only be used in follow-up messages.";
    }
    return null;
  }, [initialTemplate, clinicName]);

  function setFollowUp(slot: Slot, patch: Partial<FollowUpState>) {
    setFollowUps((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));
    setSaved(false);
  }

  function setVoiceGreeting(scenario: VoiceScenario, patch: Partial<VoiceGreetingState>) {
    setVoiceGreetings((prev) => ({ ...prev, [scenario]: { ...prev[scenario], ...patch } }));
    setSaved(false);
  }

  function resetInitial() {
    setInitialTemplate(defaultInitialTemplate);
    setSaved(false);
  }

  function resetVoiceGreeting(scenario: VoiceScenario) {
    setVoiceGreeting(scenario, { body: "" });
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
          initialTemplate,
          maxAutoReplies,
          followUps: {
            1: { body: followUps[1].body, enabled: followUps[1].enabled },
            2: { body: followUps[2].body, enabled: followUps[2].enabled },
            3: { body: followUps[3].body, enabled: followUps[3].enabled },
          },
          voiceGreetings: {
            will_send: { body: voiceGreetings.will_send.body },
            duplicate: { body: voiceGreetings.duplicate.body },
            none: { body: voiceGreetings.none.body },
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
        <div className="field">
          <label htmlFor="aisms-initial-template">Initial SMS template</label>
          <textarea
            id="aisms-initial-template"
            className="textarea"
            rows={3}
            value={initialTemplate}
            maxLength={maxInitialLen}
            placeholder={defaultInitialTemplate}
            onChange={(e) => { setInitialTemplate(e.target.value); setSaved(false); }}
            aria-invalid={initialInlineError ? "true" : "false"}
            aria-describedby="aisms-initial-helper"
          />
          <p id="aisms-initial-helper" className="helper">
            {initialTemplate.length}/{maxInitialLen}
            {initialSuggestion ? (
              <>
                {" "}· Suggestion:{" "}
                <button
                  type="button"
                  className="link"
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  onClick={() => { setInitialTemplate(initialSuggestion); setSaved(false); }}
                >
                  use “{initialSuggestion}”
                </button>
              </>
            ) : null}
          </p>
          {initialInlineError && (
            <p className="helper" style={{ color: "var(--error-text)" }}>
              {initialInlineError}
            </p>
          )}
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

      {/* Voice greeting templates */}
      <section style={{ display: "grid", gap: "var(--space-4)" }}>
        <h3 className="adm-subhead">Voice greeting</h3>
        <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
          Voice greeting is what callers hear before the call ends. The system chooses the correct
          version automatically.
        </p>
        <p className="t-helper" style={{ margin: 0, color: "var(--text-muted)" }}>
          Use <code>{"{{clinic_name}}"}</code> for the clinic profile name.
        </p>
        {VOICE_SCENARIOS.map((scenario) => {
          const state = voiceGreetings[scenario];
          return (
            <div
              key={scenario}
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
                  {state.label}
                </h4>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => resetVoiceGreeting(scenario)}
                >
                  Reset to default
                </button>
              </div>
              <p className="t-helper" style={{ margin: 0, color: "var(--text-muted)" }}>
                {state.helper}
              </p>
              <textarea
                className="textarea"
                rows={3}
                value={state.body}
                maxLength={maxVoiceLen}
                placeholder={state.defaultText}
                onChange={(e) => setVoiceGreeting(scenario, { body: e.target.value })}
              />
              <p className="helper">
                {state.body.length}/{maxVoiceLen}
                {state.suggestion ? (
                  <>
                    {" "}· Default:{" "}
                    <button
                      type="button"
                      className="link"
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      onClick={() => setVoiceGreeting(scenario, { body: state.suggestion })}
                    >
                      use “{state.suggestion}”
                    </button>
                  </>
                ) : null}
              </p>
              <PreviewBox label="Preview" text={localVoicePreviews[scenario] || state.preview} />
            </div>
          );
        })}
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
          {saving ? "Saving…" : "Save message settings"}
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

function renderLocalPreview(template: string, clinicName: string): string {
  const identity = clinicName.trim() || "your dental office";
  return template
    .replace(/\{\{\s*clinic_name\s*\}\}/gi, identity)
    .replace(/,?\s*\{\{\s*patient_name\s*\}\}/gi, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

function renderLocalVoicePreview(template: string, clinicName: string): string {
  const identity = clinicName.trim() || "us";
  return template
    .replace(/\{\{\s*clinic_name\s*\}\}/gi, identity)
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

function hasClinicIdentity(template: string, clinicName: string): boolean {
  if (/\{\{\s*clinic_name\s*\}\}/i.test(template)) return true;
  const identity = clinicName.trim().toLowerCase();
  return identity.length > 0 && template.toLowerCase().includes(identity);
}

function hasStopOptOut(template: string): boolean {
  return /\bReply\s+STOP\s+to\s+opt\s+out\.?/i.test(template);
}
