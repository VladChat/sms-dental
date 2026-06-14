import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonOk,
} from "../../../../../../../lib/http/responses";
import { requirePlatformAdminClinic } from "../../../../../../../lib/auth/admin-clinic";
import {
  AiAnsweringUnavailableError,
  AiVoiceSessionValidationError,
  createMockAiVoiceSession,
} from "../../../../../../../lib/db/ai-voice-sessions";
import {
  AI_VOICE_FIELD_LIMITS,
  AI_VOICE_SESSION_STATUSES,
} from "../../../../../../../config/ai-answering.config";
import { normalizePhone, isValidE164 } from "../../../../../../../lib/phone/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Body schema. The clinic id comes ONLY from the URL (never the body). Lengths
// mirror the ai_voice_sessions CHECK constraints so a clear 400 is returned
// before the DB rejects anything.
const MockSessionSchema = z.object({
  patientPhone: z
    .string()
    .trim()
    .min(1)
    .max(AI_VOICE_FIELD_LIMITS.patientPhone)
    .refine((value) => isValidE164(normalizePhone(value)), {
      message: "patientPhone must be a valid E.164 phone number.",
    }),
  clinicPhone: z
    .string()
    .trim()
    .max(AI_VOICE_FIELD_LIMITS.clinicPhone)
    .optional(),
  capturedPatientName: z.string().trim().max(AI_VOICE_FIELD_LIMITS.capturedPatientName).optional(),
  capturedReason: z.string().trim().max(AI_VOICE_FIELD_LIMITS.capturedReason).optional(),
  capturedPreferredTime: z
    .string()
    .trim()
    .max(AI_VOICE_FIELD_LIMITS.capturedPreferredTime)
    .optional(),
  status: z.enum(AI_VOICE_SESSION_STATUSES).default("captured"),
  safetySignal: z.boolean().optional(),
  handoffNote: z.string().trim().max(AI_VOICE_FIELD_LIMITS.handoffNote).optional(),
});

// POST /api/admin/clinics/[clinicId]/ai-answering/mock-session
//
// PLATFORM-ADMIN ONLY foundation/test endpoint. It creates a fake AI answered
// call session for a clinic so the Workspace can display an AI-sourced patient
// request — WITHOUT any Twilio, OpenAI, SMS, or live AI runtime. Clinic
// owners/front-desk cannot call this unless they are a platform admin.
//
// Do NOT run this against production unless explicitly approved (it writes a real
// conversation + ai_voice_sessions row for the target clinic).
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
): Promise<NextResponse> {
  const { clinicId } = await ctx.params;

  // Platform-admin guard for this exact clinic (id from the URL, validated).
  const guard = await requirePlatformAdminClinic(req, clinicId);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body.");
  }

  const parsed = MockSessionSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid request.";
    return jsonBadRequest(first);
  }

  try {
    const { sessionId, conversationId } = await createMockAiVoiceSession({
      clinicId: guard.clinic.id,
      patientPhone: parsed.data.patientPhone,
      clinicPhone: parsed.data.clinicPhone ?? null,
      capturedPatientName: parsed.data.capturedPatientName ?? null,
      capturedReason: parsed.data.capturedReason ?? null,
      capturedPreferredTime: parsed.data.capturedPreferredTime ?? null,
      status: parsed.data.status,
      safetySignal: parsed.data.safetySignal ?? false,
      handoffNote: parsed.data.handoffNote ?? null,
      // Mocks get a unique external id so the (clinic, source, external_id)
      // idempotency index is exercised and repeat calls never collide.
      externalSessionId: `mock-${randomUUID()}`,
    });
    return jsonOk({ ok: true, sessionId, conversationId });
  } catch (err) {
    if (err instanceof AiAnsweringUnavailableError) {
      return jsonError(
        503,
        "ai_answering_unavailable",
        "AI answering is not available yet. Apply the AI answering migration first.",
      );
    }
    if (err instanceof AiVoiceSessionValidationError) {
      return jsonBadRequest(err.message);
    }
    return jsonError(500, "mock_session_failed", "Could not create the mock AI session.");
  }
}
