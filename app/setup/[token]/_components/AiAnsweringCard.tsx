"use client";

import { includedAiAnsweredMinutesLabel } from "../../../../config/notifications.config";
import { getDefaultVoiceOption } from "../../../../config/voice-greeting.config";

// AI Answering — account section (NON-LIVE foundation).
//
// Honest, read-only status ONLY. AI Answering is being prepared and is NOT
// active. There is intentionally no enable toggle, no activation button, no
// usage/delivery charts, and no promise that anything is working. The included-
// minutes number comes from billing config via the shared helper (never a second
// source). The voice shown is a future preference only and runs nothing.
export function AiAnsweringCard() {
  const defaultVoice = getDefaultVoiceOption();
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <p className="t-body">AI Answering is being prepared. SMS approval remains separate.</p>
      <p className="t-small">
        When it is ready, AI Answering will use your approved AI Front Desk
        Knowledge only. It never gives medical advice and never replaces your front
        desk.
      </p>
      <p className="t-small">
        Your plan includes {includedAiAnsweredMinutesLabel()} AI answered call minutes.
      </p>
      <p className="t-small" style={{ color: "var(--text-secondary)" }}>
        Future AI voice preference: {defaultVoice.label} (default). You will be able
        to choose a voice before AI Answering goes live.
      </p>
    </div>
  );
}
