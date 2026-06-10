// Voice greeting and future voice-selection foundation.
//
// This product is US-first, so default spoken language is always en-US. The
// customer-facing picker should expose this curated set, not Twilio's full voice
// catalog. The list is operator-curated from Twilio's current <Say> Text-to-
// Speech docs, verified 2026-06-10:
// https://www.twilio.com/docs/voice/twiml/say/text-speech
//
// Twilio notes that third-party and beta/generative voices can change without
// prior notice, so each option stores an internal note when provider availability
// is preview/beta/vendor-dependent.

export type VoiceGenderPresentation = "female" | "male";

export type CuratedVoiceOption = {
  id: string;
  label: string;
  provider: "polly" | "google";
  twilioVoice: string;
  language: "en-US";
  genderPresentation: VoiceGenderPresentation;
  tone: string;
  customerDescription: string;
  internalNote?: string;
};

export type VoiceGreetingConfig = {
  defaultLanguage: "en-US";
  defaultVoiceId: string;
  curationNote: string;
  options: readonly CuratedVoiceOption[];
};

const GENERATIVE_NOTE =
  "Generative/third-party voice availability is provider-dependent and may change; verify in Twilio before broad launch.";

export const voiceGreetingConfig: VoiceGreetingConfig = {
  defaultLanguage: "en-US",
  defaultVoiceId: "google-leda",
  curationNote:
    "Operator-curated English US list for clinic voice settings; not a provider ranking.",
  options: [
    {
      id: "google-aoede",
      label: "Aoede",
      provider: "google",
      twilioVoice: "Google.en-US-Chirp3-HD-Aoede",
      language: "en-US",
      genderPresentation: "female",
      tone: "warm",
      customerDescription: "Warm, natural voice for friendly front-desk greetings.",
      internalNote: GENERATIVE_NOTE,
    },
    {
      id: "google-kore",
      label: "Kore",
      provider: "google",
      twilioVoice: "Google.en-US-Chirp3-HD-Kore",
      language: "en-US",
      genderPresentation: "female",
      tone: "professional",
      customerDescription: "Professional, steady voice for clear office messages.",
      internalNote: GENERATIVE_NOTE,
    },
    {
      id: "google-leda",
      label: "Leda",
      provider: "google",
      twilioVoice: "Google.en-US-Chirp3-HD-Leda",
      language: "en-US",
      genderPresentation: "female",
      tone: "calm",
      customerDescription: "Calm, human-like voice for reassuring missed-call greetings.",
      internalNote: GENERATIVE_NOTE,
    },
    {
      id: "google-zephyr",
      label: "Zephyr",
      provider: "google",
      twilioVoice: "Google.en-US-Chirp3-HD-Zephyr",
      language: "en-US",
      genderPresentation: "female",
      tone: "clear",
      customerDescription: "Clear, approachable voice for concise patient updates.",
      internalNote: GENERATIVE_NOTE,
    },
    {
      id: "polly-ruth",
      label: "Ruth",
      provider: "polly",
      twilioVoice: "Polly.Ruth-Generative",
      language: "en-US",
      genderPresentation: "female",
      tone: "polished",
      customerDescription: "Polished voice for a professional dental-office tone.",
      internalNote: GENERATIVE_NOTE,
    },
    {
      id: "google-charon",
      label: "Charon",
      provider: "google",
      twilioVoice: "Google.en-US-Chirp3-HD-Charon",
      language: "en-US",
      genderPresentation: "male",
      tone: "calm",
      customerDescription: "Calm, measured voice for reassuring caller messages.",
      internalNote: GENERATIVE_NOTE,
    },
    {
      id: "google-fenrir",
      label: "Fenrir",
      provider: "google",
      twilioVoice: "Google.en-US-Chirp3-HD-Fenrir",
      language: "en-US",
      genderPresentation: "male",
      tone: "professional",
      customerDescription: "Professional voice for concise office follow-up prompts.",
      internalNote: GENERATIVE_NOTE,
    },
    {
      id: "google-orus",
      label: "Orus",
      provider: "google",
      twilioVoice: "Google.en-US-Chirp3-HD-Orus",
      language: "en-US",
      genderPresentation: "male",
      tone: "clear",
      customerDescription: "Clear, direct voice for easy-to-understand greetings.",
      internalNote: GENERATIVE_NOTE,
    },
    {
      id: "google-puck",
      label: "Puck",
      provider: "google",
      twilioVoice: "Google.en-US-Chirp3-HD-Puck",
      language: "en-US",
      genderPresentation: "male",
      tone: "friendly",
      customerDescription: "Friendly, conversational voice for approachable follow-up.",
      internalNote: GENERATIVE_NOTE,
    },
    {
      id: "polly-matthew",
      label: "Matthew",
      provider: "polly",
      twilioVoice: "Polly.Matthew-Generative",
      language: "en-US",
      genderPresentation: "male",
      tone: "polished",
      customerDescription: "Polished voice for a confident office greeting.",
      internalNote: GENERATIVE_NOTE,
    },
  ],
};

export function getDefaultVoiceOption(): CuratedVoiceOption {
  const option = voiceGreetingConfig.options.find(
    (voice) => voice.id === voiceGreetingConfig.defaultVoiceId,
  );
  if (!option) {
    throw new Error("default voice id is not present in curated voice options");
  }
  return option;
}
