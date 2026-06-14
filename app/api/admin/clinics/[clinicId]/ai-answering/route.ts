import { NextResponse, type NextRequest } from "next/server";

import { jsonOk } from "../../../../../../lib/http/responses";
import { requirePlatformAdminClinic } from "../../../../../../lib/auth/admin-clinic";
import {
  countAiVoiceSessionsForClinic,
  getClinicAiAnsweringSettings,
  listLatestAiVoiceSessionsForClinic,
} from "../../../../../../lib/db/ai-voice-sessions";
import { voiceGreetingConfig } from "../../../../../../config/voice-greeting.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSIONS_LIMIT = 20;

// Mask a stored phone to the last 4 digits only, matching the admin convention
// that caller numbers are not shown in full in the console.
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `••• ••• ${digits.slice(-4)}`;
}

function voiceLabelFor(voiceId: string): string {
  return voiceGreetingConfig.options.find((o) => o.id === voiceId)?.label ?? voiceId;
}

// GET /api/admin/clinics/[clinicId]/ai-answering
//
// PLATFORM-ADMIN ONLY read for the AI Answering tab. Returns the (future) voice
// preference and the latest MOCK AI voice sessions for the clinic so an admin can
// verify how an AI answered call will appear in Workspace. NON-LIVE: no AI runs,
// no provider is contacted. Degradation-safe: if the ai_voice_sessions table is
// not applied yet (e.g. local dev), returns ok with foundationApplied:false.
//
// Returns only admin-safe fields — never provider IDs, raw payloads,
// transcripts/audio, Twilio SIDs, OpenAI fields, secrets, or DB internals. Phone
// numbers are masked to the last 4 digits.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
): Promise<NextResponse> {
  const { clinicId } = await ctx.params;

  const guard = await requirePlatformAdminClinic(req, clinicId);
  if (!guard.ok) return guard.response;

  const id = guard.clinic.id;
  const settings = await getClinicAiAnsweringSettings(id);
  const totalCount = await countAiVoiceSessionsForClinic(id);
  const foundationApplied = totalCount !== null;
  const sessions = foundationApplied
    ? await listLatestAiVoiceSessionsForClinic(id, SESSIONS_LIMIT)
    : [];

  return jsonOk({
    ok: true,
    // false when the AI answering migration is not applied to this database yet
    // (production has it applied; this mainly guards local dev).
    foundationApplied,
    settings: {
      selectedVoiceId: settings.selectedVoiceId,
      voiceLabel: voiceLabelFor(settings.selectedVoiceId),
    },
    totalCount: foundationApplied ? totalCount : 0,
    sessions: sessions.map((s) => ({
      id: s.id,
      patientPhoneMasked: maskPhone(s.patientPhone),
      status: s.status,
      source: s.source,
      capturedPatientName: s.capturedPatientName,
      capturedReason: s.capturedReason,
      capturedPreferredTime: s.capturedPreferredTime,
      summaryHeadline: s.summaryHeadline,
      handoffNote: s.handoffNote,
      safetySignal: s.safetySignal,
      smsFollowupRecommended: s.smsFollowupRecommended,
      createdAt: s.createdAt.toISOString(),
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    })),
  });
}
