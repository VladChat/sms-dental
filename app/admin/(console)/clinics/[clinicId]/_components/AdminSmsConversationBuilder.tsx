"use client";

import { useEffect, useMemo, useState } from "react";

// Platform-admin-only SMS Conversation Builder. Configures deterministic
// missed-call recovery messages for ONE clinic. Clinic owners cannot edit this.
// No AI: templates are validated server-side and sent only through guarded paths.

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
type Slot = (typeof SLOTS)[number];
const PRIMARY_SLOTS = [1, 2, 3] as const;
const ADDITIONAL_SLOTS = [4, 5, 6, 7, 8, 9, 10] as const;
const SLOTS_WITH_ZERO = [0, ...SLOTS] as const;
const VOICE_SCENARIOS = ["will_send", "duplicate", "none"] as const;
type VoiceScenario = (typeof VOICE_SCENARIOS)[number];

type FollowUpView = {
  customBody: string | null;
  defaultText: string | null;
  effectiveText: string;
  isCustom: boolean;
  preview: string;
  enabled: boolean;
};

type VoiceGreetingView = {
  customBody: string | null;
  defaultText: string;
  effectiveText: string;
  isCustom: boolean;
  preview: string;
  label: string;
  helper: string;
};

type ConfigPayload = {
  clinicName: string;
  config: {
    initial: {
      customBody: string | null;
      defaultText: string;
      effectiveText: string;
      isCustom: boolean;
      preview: string;
    };
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

type FollowUpState = {
  body: string;
  enabled: boolean;
  defaultText: string;
  hasCodeTemplate: boolean;
  preview: string;
};

type VoiceGreetingState = {
  body: string;
  defaultText: string;
  preview: string;
  label: string;
  helper: string;
};

type LoadState = "loading" | "error" | "ready";

function emptyFollowUpRecord(): Record<Slot, FollowUpState> {
  return Object.fromEntries(
    SLOTS.map((slot) => [
      slot,
      { body: "", enabled: false, defaultText: "", hasCodeTemplate: slot <= 3, preview: "" },
    ]),
  ) as Record<Slot, FollowUpState>;
}

export function AdminSmsConversationBuilder({ clinicId }: { clinicId: string }) {
  const [load, setLoad] = useState<LoadState>("loading");
  const [editing, setEditing] = useState(false);
  const [clinicName, setClinicName] = useState("");
  const [defaultInitialTemplate, setDefaultInitialTemplate] = useState("");
  const [initialTemplate, setInitialTemplate] = useState("");
  const [maxAutoReplies, setMaxAutoReplies] = useState(0);
  const [followUps, setFollowUps] = useState<Record<Slot, FollowUpState>>(emptyFollowUpRecord);
  const [voiceGreetings, setVoiceGreetings] = useState<Record<VoiceScenario, VoiceGreetingState>>({
    will_send: { body: "", defaultText: "", preview: "", label: "When a new SMS will be sent", helper: "" },
    duplicate: { body: "", defaultText: "", preview: "", label: "When this caller was already texted recently", helper: "" },
    none: { body: "", defaultText: "", preview: "", label: "When no SMS will be sent", helper: "" },
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
    setDefaultInitialTemplate(data.config.initial.defaultText);
    setInitialTemplate(data.config.initial.effectiveText);
    setMaxAutoReplies(data.config.maxAutoReplies);

    const nextFollowUps = { ...followUps };
    for (const slot of SLOTS) {
      const fu = data.config.followUps[String(slot)];
      const defaultText = fu?.defaultText ?? "";
      const hasCodeTemplate = (fu?.defaultText ?? "").trim().length > 0;
      nextFollowUps[slot] = {
        body: fu?.effectiveText ?? defaultText,
        enabled: fu?.enabled ?? false,
        defaultText,
        hasCodeTemplate,
        preview: fu?.preview ?? "",
      };
    }
    setFollowUps(nextFollowUps);

    const nextVoice = { ...voiceGreetings };
    for (const scenario of VOICE_SCENARIOS) {
      const vg = data.config.voiceGreetings?.[scenario];
      const defaultText = vg?.defaultText ?? "";
      nextVoice[scenario] = {
        body: vg?.effectiveText ?? defaultText,
        defaultText,
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

  const localInitialPreview = useMemo(() => {
    return renderLocalPreview(initialTemplate, clinicName);
  }, [initialTemplate, clinicName]);

  const localFollowUpPreviews = useMemo(() => {
    return Object.fromEntries(
      SLOTS.map((slot) => [
        slot,
        renderLocalPreview(effectiveFollowUpBodyForEditor(followUps[slot]), clinicName, "Alex"),
      ]),
    ) as Record<Slot, string>;
  }, [followUps, clinicName]);

  const localVoicePreviews = useMemo(() => {
    return Object.fromEntries(
      VOICE_SCENARIOS.map((scenario) => [
        scenario,
        renderLocalVoicePreview(voiceGreetings[scenario].body, clinicName),
      ]),
    ) as Record<VoiceScenario, string>;
  }, [voiceGreetings, clinicName]);

  const initialInlineError = useMemo(() => {
    const source = initialTemplate.trim();
    if (!source) return null;
    if (!hasClinicIdentity(source, clinicName)) {
      return "Include the clinic identity with {{clinic_name}}.";
    }
    if (!hasStopOptOut(source)) {
      return "Include \"Reply STOP to opt out.\"";
    }
    if (/\{\{\s*patient_name\s*\}\}/i.test(source)) {
      return "{{patient_name}} can only be used in follow-up messages.";
    }
    return null;
  }, [initialTemplate, clinicName]);

  function beginEdit() {
    setEditing(true);
    setSaved(false);
    setError(null);
  }

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

  function resetFollowUp(slot: Slot) {
    if (followUps[slot].hasCodeTemplate) {
      setFollowUp(slot, { body: followUps[slot].defaultText });
    } else {
      setFollowUp(slot, { body: "", enabled: false });
    }
  }

  function resetVoiceGreeting(scenario: VoiceScenario) {
    setVoiceGreeting(scenario, { body: voiceGreetings[scenario].defaultText });
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
          followUps: Object.fromEntries(
            SLOTS.map((slot) => [slot, { body: followUps[slot].body, enabled: followUps[slot].enabled }]),
          ),
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
      setEditing(false);
      setSaved(true);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (load === "loading") {
    return <p className="t-small" role="status" aria-live="polite">Loading...</p>;
  }
  if (load === "error") {
    return (
      <div className="alert alert-error" role="alert">
        <span>We couldn't load the SMS settings. Please refresh and try again.</span>
      </div>
    );
  }

  let contiguousEnabled = 0;
  for (const slot of SLOTS) {
    const hasUsableBody =
      followUps[slot].body.trim().length > 0 || followUps[slot].hasCodeTemplate;
    if (followUps[slot].enabled && hasUsableBody) contiguousEnabled += 1;
    else break;
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <div className="adm-section-head" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <p className="t-helper" style={{ margin: 0, color: "var(--text-muted)" }}>
            Configure deterministic missed-call voice and SMS messages. Clinic identity, opt-out
            handling, and send gates stay server-controlled.
          </p>
          <VariableHelper />
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
          {editing ? (
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={beginEdit}>
              Edit
            </button>
          )}
          {saved && !error && (
            <span className="t-small" role="status" aria-live="polite" style={{ color: "var(--success-text)" }}>
              Saved.
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{error}</span>
        </div>
      )}

      <section
        style={{
          display: "grid",
          gap: "var(--space-4)",
          padding: "var(--space-4)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <h3 className="adm-subhead" style={{ margin: 0 }}>Voice greeting</h3>
          <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
            Callers hear this before the call ends. The system chooses the correct version automatically.
          </p>
        </div>

        {VOICE_SCENARIOS.map((scenario) => {
          const state = voiceGreetings[scenario];
          return (
            <div
              key={scenario}
              style={{
                display: "grid",
                gap: "var(--space-2)",
                paddingTop: "var(--space-4)",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div className="adm-section-head">
                <div style={{ display: "grid", gap: "var(--space-1)" }}>
                  <label className="t-small" style={{ fontWeight: 700, margin: 0 }}>
                    {state.label}
                  </label>
                  <p className="t-helper" style={{ margin: 0, color: "var(--text-muted)" }}>
                    {state.helper}
                  </p>
                </div>
                {editing && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => resetVoiceGreeting(scenario)}
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <textarea
                className="textarea"
                rows={3}
                value={state.body}
                maxLength={maxVoiceLen}
                readOnly={!editing}
                aria-readonly={!editing}
                onChange={(e) => setVoiceGreeting(scenario, { body: e.target.value })}
              />
              {editing && <p className="helper">{state.body.length}/{maxVoiceLen}</p>}
              <PreviewBox label="Preview" text={localVoicePreviews[scenario] || state.preview} />
            </div>
          );
        })}
      </section>

      <section
        style={{
          display: "grid",
          gap: "var(--space-4)",
          padding: "var(--space-4)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <h3 className="adm-subhead" style={{ margin: 0 }}>SMS messages</h3>
          <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
            The initial SMS sends after a missed call. Follow-ups send only after patient replies,
            within the maximum below.
          </p>
        </div>

        <div className="field">
          <div className="adm-section-head">
            <label htmlFor="aisms-initial-template">Initial SMS</label>
            {editing && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetInitial}>
                Reset to default
              </button>
            )}
          </div>
          <textarea
            id="aisms-initial-template"
            className="textarea"
            rows={3}
            value={initialTemplate}
            maxLength={maxInitialLen}
            readOnly={!editing}
            aria-readonly={!editing}
            onChange={(e) => { setInitialTemplate(e.target.value); setSaved(false); }}
            aria-invalid={initialInlineError ? "true" : "false"}
          />
          {editing && <p className="helper">{initialTemplate.length}/{maxInitialLen}</p>}
          {initialInlineError && (
            <p className="helper" style={{ color: "var(--error-text)" }}>
              {initialInlineError}
            </p>
          )}
          <PreviewBox label="Preview" text={localInitialPreview || initialPreview} />
        </div>

        {PRIMARY_SLOTS.map((slot) => (
          <FollowUpEditor
            key={slot}
            slot={slot}
            state={followUps[slot]}
            editing={editing}
            saving={saving}
            maxBodyLen={maxBodyLen}
            preview={localFollowUpPreviews[slot]}
            onChange={setFollowUp}
            onReset={resetFollowUp}
          />
        ))}

        <details
          style={{
            display: "grid",
            gap: "var(--space-3)",
            paddingTop: "var(--space-4)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <summary className="t-small" style={{ cursor: "pointer", fontWeight: 700 }}>
            Additional follow-ups
          </summary>
          <div style={{ display: "grid", gap: "var(--space-4)", paddingTop: "var(--space-3)" }}>
            <p className="t-helper" style={{ margin: 0, color: "var(--text-muted)" }}>
              Follow-ups #4-#10 require custom text before they can be enabled.
            </p>
            {ADDITIONAL_SLOTS.map((slot) => (
              <FollowUpEditor
                key={slot}
                slot={slot}
                state={followUps[slot]}
                editing={editing}
                saving={saving}
                maxBodyLen={maxBodyLen}
                preview={localFollowUpPreviews[slot]}
                onChange={setFollowUp}
                onReset={resetFollowUp}
              />
            ))}
          </div>
        </details>

        <section className="field" style={{ maxWidth: 340 }}>
          <label htmlFor="aisms-max">Maximum automated replies</label>
          <select
            id="aisms-max"
            className="select"
            value={maxAutoReplies}
            disabled={!editing || saving}
            onChange={(e) => { setMaxAutoReplies(Number(e.target.value)); setSaved(false); }}
          >
            {SLOTS_WITH_ZERO.map((n) => (
              <option key={n} value={n} disabled={n > contiguousEnabled}>
                {n}{n > contiguousEnabled ? " (enable follow-ups first)" : ""}
              </option>
            ))}
          </select>
          <p className="helper">
            0 turns off automated follow-ups. The limit can't exceed the enabled follow-ups in order.
          </p>
        </section>
      </section>
    </div>
  );
}

function VariableHelper() {
  return (
    <div className="t-helper" style={{ display: "grid", gap: "var(--space-1)", color: "var(--text-muted)" }}>
      <div>SMS variables: <code>{"{{clinic_name}}"}</code>, <code>{"{{patient_name}}"}</code></div>
      <div>Voice variables: <code>{"{{clinic_name}}"}</code></div>
    </div>
  );
}

function FollowUpEditor({
  slot,
  state,
  editing,
  saving,
  maxBodyLen,
  preview,
  onChange,
  onReset,
}: {
  slot: Slot;
  state: FollowUpState;
  editing: boolean;
  saving: boolean;
  maxBodyLen: number;
  preview: string;
  onChange: (slot: Slot, patch: Partial<FollowUpState>) => void;
  onReset: (slot: Slot) => void;
}) {
  const hasCustomText = state.body.trim().length > 0;
  const canEnable = state.hasCodeTemplate || hasCustomText;

  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-2)",
        paddingTop: "var(--space-4)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="adm-section-head">
        <label className="t-small" style={{ fontWeight: 700, margin: 0 }}>
          Follow-up #{slot}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <label className="check" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={state.enabled}
              disabled={!editing || saving || (!state.enabled && !canEnable)}
              onChange={(e) => onChange(slot, { enabled: e.target.checked })}
            />
            <span>Enabled</span>
          </label>
          {editing && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onReset(slot)}>
              {state.hasCodeTemplate ? "Reset to default" : "Clear"}
            </button>
          )}
        </div>
      </div>
      <p className="t-helper" style={{ margin: 0, color: "var(--text-muted)" }}>
        Sends after the {ordinal(slot)} patient reply.
      </p>
      <textarea
        className="textarea"
        rows={2}
        value={state.body}
        maxLength={maxBodyLen}
        readOnly={!editing}
        aria-readonly={!editing}
        onChange={(e) => {
          const body = e.target.value;
          onChange(slot, {
            body,
            ...(!state.hasCodeTemplate && body.trim().length === 0 ? { enabled: false } : {}),
          });
        }}
      />
      {editing && <p className="helper">{state.body.length}/{maxBodyLen}</p>}
      <PreviewBox label="Preview" text={preview} />
    </div>
  );
}

function PreviewBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="field" style={{ gap: "var(--space-1)" }}>
      <label className="t-helper" style={{ color: "var(--text-muted)" }}>{label}</label>
      <div
        className="t-small"
        style={{
          padding: "var(--space-2) var(--space-3)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)",
          background: "var(--surface-sunken)",
          color: "var(--text-secondary)",
          whiteSpace: "pre-wrap",
        }}
      >
        {text || "-"}
      </div>
    </div>
  );
}

function effectiveFollowUpBodyForEditor(state: FollowUpState): string {
  const body = state.body.trim();
  if (body.length > 0) return state.body;
  return state.hasCodeTemplate ? state.defaultText : "";
}

function ordinal(slot: Slot): string {
  switch (slot) {
    case 1:
      return "first";
    case 2:
      return "second";
    case 3:
      return "third";
    default:
      return `${slot}th`;
  }
}

function renderLocalPreview(template: string, clinicName: string, patientName?: string): string {
  const identity = clinicName.trim() || "your dental office";
  const name = (patientName ?? "").trim();
  let out = template.replace(/\{\{\s*clinic_name\s*\}\}/gi, identity);
  out = name.length > 0
    ? out.replace(/\{\{\s*patient_name\s*\}\}/gi, name)
    : out.replace(/,?\s*\{\{\s*patient_name\s*\}\}/gi, "");
  return out
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
