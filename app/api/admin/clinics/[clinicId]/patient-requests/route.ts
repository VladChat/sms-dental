import { NextResponse, type NextRequest } from "next/server";

import { jsonError, jsonOk } from "../../../../../../lib/http/responses";
import { requirePlatformAdminClinic } from "../../../../../../lib/auth/admin-clinic";
import { listClinicConversations } from "../../../../../../lib/db/front-desk";
import { toPatientRequestCard } from "../../../../../../lib/workspace/patient-request-card";
import { normalizeWorkspaceDisplayName } from "../../../../../../lib/workspace/display-name";
import { workspaceSourceChannelLabel } from "../../../../../../lib/workspace/ai-voice-summary";
import {
  workspaceSectionForCard,
  type PatientRequestCard,
} from "../../../../../workspace/_components/workspace-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUESTS_LIMIT = 100;

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `***-***-${digits.slice(-4)}`;
}

function sectionLabel(card: PatientRequestCard): string {
  switch (workspaceSectionForCard(card.flags)) {
    case "blocked":
      return "Blocked";
    case "handled":
      return "Handled";
    default:
      return "Needs follow-up";
  }
}

function timestampMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

// GET /api/admin/clinics/[clinicId]/patient-requests
//
// PLATFORM-ADMIN ONLY read-only preview for the selected admin clinic. The
// clinic id is taken from the URL/guard, never from the admin's workspace
// account context. Returns display-safe request data only: no raw payloads,
// provider identifiers, billing/legal details, secrets, diagnostics, or message
// bodies. Caller phones are masked to last 4.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
): Promise<NextResponse> {
  const { clinicId } = await ctx.params;

  const guard = await requirePlatformAdminClinic(req, clinicId);
  if (!guard.ok) return guard.response;

  try {
    const conversations = await listClinicConversations(guard.clinic.id, REQUESTS_LIMIT);
    const cards = conversations
      .map((conversation) => {
        const card = toPatientRequestCard(conversation);
        const capturedName = conversation.aiVoiceCapturedName
          ? normalizeWorkspaceDisplayName(conversation.aiVoiceCapturedName)
          : null;
        return { card, capturedName };
      })
      .sort((a, b) => timestampMs(b.card.lastActivityAt) - timestampMs(a.card.lastActivityAt));

    return jsonOk({
      ok: true,
      clinic: {
        name: guard.clinic.name,
        slug: guard.clinic.slug,
      },
      requests: cards.map(({ card, capturedName }, index) => ({
        requestKey: `request-${index + 1}`,
        callerPhoneMasked: maskPhone(card.callerPhone),
        patientName: card.patientName,
        statusLabel: sectionLabel(card),
        sourceChannel: card.sourceChannel,
        sourceLabel: workspaceSourceChannelLabel(card.sourceChannel),
        summaryHeadline: card.summaryHeadline,
        createdAt: card.createdAt,
        lastActivityAt: card.lastActivityAt,
        smsMessageCount: card.timeline.length,
        aiVoice: card.aiVoice
          ? {
              summaryHeadline: card.aiVoice.summaryHeadline,
              capturedName,
              reason: card.aiVoice.reason,
              preferredTime: card.aiVoice.preferredTime,
              safetyConcern: card.aiVoice.safetyConcern,
              handoffNote: card.aiVoice.handoffNote,
              capturedAt: card.aiVoice.capturedAt,
            }
          : null,
      })),
    });
  } catch {
    return jsonError(500, "load_failed", "We couldn't load patient requests. Please try again.");
  }
}
