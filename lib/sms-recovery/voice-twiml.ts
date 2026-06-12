import {
  getDefaultVoiceOption,
  voiceGreetingConfig,
} from "../../config/voice-greeting.config";
import {
  buildVoiceGreetingMessage,
  type VoiceGreetingScenario,
  type VoiceGreetingTemplateConfig,
} from "./voice-greeting-templates";

export type VoiceGreetingPrediction = VoiceGreetingScenario;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSayTwiml(message: string): string {
  const voice = getDefaultVoiceOption();
  return (
    `<Response><Say language="${voiceGreetingConfig.defaultLanguage}" ` +
    `voice="${escapeXml(voice.twilioVoice)}">${escapeXml(message)}</Say><Hangup/></Response>`
  );
}

export function buildMissedCallVoiceTwiml(
  clinicName: string | null | undefined,
  prediction: VoiceGreetingPrediction,
  voiceGreetings?: VoiceGreetingTemplateConfig | null,
): string {
  return buildSayTwiml(buildVoiceGreetingMessage(clinicName, prediction, voiceGreetings));
}

export function buildInactiveNumberVoiceTwiml(): string {
  return buildSayTwiml("This number is no longer in service.");
}
