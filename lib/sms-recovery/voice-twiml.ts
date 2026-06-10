import {
  getDefaultVoiceOption,
  voiceGreetingConfig,
} from "../../config/voice-greeting.config";

export type VoiceGreetingPrediction = "will_send" | "duplicate" | "none";

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
    `voice="${escapeXml(voice.twilioVoice)}">${message}</Say><Hangup/></Response>`
  );
}

export function buildMissedCallVoiceTwiml(
  clinicName: string | null,
  prediction: VoiceGreetingPrediction,
): string {
  const name = clinicName ? escapeXml(clinicName) : "us";
  let message: string;
  if (prediction === "will_send") {
    message =
      `Hi, thanks for calling ${name}. ` +
      "We're sorry we missed you. " +
      "We'll send you a text now, so our team can follow up.";
  } else if (prediction === "duplicate") {
    message =
      `Hi, thanks for calling ${name}. ` +
      "We're sorry we missed you. " +
      "We already sent a text, and our team will follow up shortly.";
  } else {
    message =
      `Hi, thanks for calling ${name}. ` +
      "We're sorry we missed you. " +
      "Our team will follow up shortly.";
  }
  return buildSayTwiml(message);
}

export function buildInactiveNumberVoiceTwiml(): string {
  return buildSayTwiml("This number is no longer in service.");
}
