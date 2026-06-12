export const VOICE_GREETING_SCENARIOS = ["will_send", "duplicate", "none"] as const;

export type VoiceGreetingScenario = (typeof VOICE_GREETING_SCENARIOS)[number];

export const VOICE_GREETING_SEQUENCE_BY_SCENARIO: Record<VoiceGreetingScenario, 1 | 2 | 3> = {
  will_send: 1,
  duplicate: 2,
  none: 3,
};

export const VOICE_GREETING_SCENARIO_BY_SEQUENCE: Record<1 | 2 | 3, VoiceGreetingScenario> = {
  1: "will_send",
  2: "duplicate",
  3: "none",
};

export const DEFAULT_VOICE_GREETING_TEMPLATES: Record<VoiceGreetingScenario, string> = {
  will_send:
    "Hi, thanks for calling {{clinic_name}}. We're sorry we missed you. We'll send you a text now, so our team can follow up.",
  duplicate:
    "Hi, thanks for calling {{clinic_name}}. We're sorry we missed you. We already sent a text, and our team will follow up shortly.",
  none:
    "Hi, thanks for calling {{clinic_name}}. We're sorry we missed you. Our team will follow up shortly.",
};

export const VOICE_GREETING_LABELS: Record<VoiceGreetingScenario, string> = {
  will_send: "Will send text",
  duplicate: "Duplicate text",
  none: "No text",
};

export const VOICE_GREETING_HELPERS: Record<VoiceGreetingScenario, string> = {
  will_send: "Used when the missed-call text will be sent after the call.",
  duplicate: "Used when a recent missed-call text already exists.",
  none: "Used when no missed-call text will be sent.",
};

export const MAX_VOICE_GREETING_TEMPLATE_LENGTH = 240;

export type VoiceGreetingTemplateConfig = Record<VoiceGreetingScenario, { body: string | null }>;

export function defaultVoiceGreetingTemplateConfig(): VoiceGreetingTemplateConfig {
  return {
    will_send: { body: null },
    duplicate: { body: null },
    none: { body: null },
  };
}

export function voiceGreetingTemplateForScenario(
  config: VoiceGreetingTemplateConfig | null | undefined,
  scenario: VoiceGreetingScenario,
): string {
  const saved = (config?.[scenario]?.body ?? "").trim();
  return saved.length > 0 ? saved : DEFAULT_VOICE_GREETING_TEMPLATES[scenario];
}

export function buildVoiceGreetingMessage(
  clinicName: string | null | undefined,
  scenario: VoiceGreetingScenario,
  config?: VoiceGreetingTemplateConfig | null,
): string {
  return renderVoiceGreetingTemplate(voiceGreetingTemplateForScenario(config, scenario), {
    clinicName,
  });
}

export function renderVoiceGreetingTemplate(
  text: string,
  ctx: { clinicName: string | null | undefined },
): string {
  let out = text.replace(/\{\{\s*clinic_name\s*\}\}/gi, resolveVoiceClinicIdentity(ctx.clinicName));
  out = out.replace(/\{\{[^}]*\}\}/g, "");
  out = out.replace(/\s+/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim();
  return out;
}

function resolveVoiceClinicIdentity(clinicName: string | null | undefined): string {
  const clean = (clinicName ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 0 ? clean : "us";
}
