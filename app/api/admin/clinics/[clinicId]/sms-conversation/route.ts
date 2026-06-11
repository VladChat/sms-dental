import { type NextRequest, type NextResponse } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../../../lib/http/responses";
import { requirePlatformAdminClinic } from "../../../../../../lib/auth/admin-clinic";
import {
  getClinicConversationConfig,
  saveClinicConversationConfig,
} from "../../../../../../lib/db/sms-conversation-settings";
import {
  buildInitialSmsBody,
  DEFAULT_FOLLOW_UP_SUGGESTIONS,
  DEFAULT_INITIAL_MIDDLE,
  followUpBodyForSlot,
  INITIAL_PREFIX_TEMPLATE,
  INITIAL_SUFFIX,
  MAX_INITIAL_MIDDLE_LENGTH,
  MAX_TEMPLATE_BODY_LENGTH,
  renderConversationTemplate,
  SUPPORTED_TEMPLATE_VARIABLES,
  type FollowUpSlot,
} from "../../../../../../lib/sms-recovery/conversation-templates";
import {
  validateFollowUpBody,
  validateInitialMiddle,
} from "../../../../../../lib/sms-recovery/template-safety";
import { recordAdminAuditEvent } from "../../../../../../lib/db/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLOTS: FollowUpSlot[] = [1, 2, 3];
// Sample name used only for follow-up previews ({{patient_name}}).
const PREVIEW_PATIENT_NAME = "Alex";

// GET /api/admin/clinics/[clinicId]/sms-conversation
// Returns the saved config, defaults/suggestions, live previews, and limits.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
): Promise<NextResponse> {
  const { clinicId } = await ctx.params;
  const guard = await requirePlatformAdminClinic(req, clinicId);
  if (!guard.ok) return guard.response;

  try {
    const config = await getClinicConversationConfig(clinicId);
    const clinicName = guard.clinic.name;

    const followUps = Object.fromEntries(
      SLOTS.map((slot) => {
        const body = config.followUps[slot]?.body ?? null;
        const enabled = config.followUps[slot]?.enabled ?? false;
        const suggestion = DEFAULT_FOLLOW_UP_SUGGESTIONS[slot];
        const previewSource = (body ?? "").trim().length > 0 ? body! : suggestion;
        return [
          slot,
          {
            body,
            enabled,
            suggestion,
            preview: renderConversationTemplate(previewSource, {
              clinicName,
              patientName: PREVIEW_PATIENT_NAME,
            }),
          },
        ];
      }),
    );

    return jsonOk({
      ok: true,
      clinicName,
      config: {
        initialMiddle: config.initialMiddle,
        defaultInitialMiddle: DEFAULT_INITIAL_MIDDLE,
        maxAutoReplies: config.maxAutoReplies,
        followUps,
      },
      preview: {
        initialPrefix: renderConversationTemplate(INITIAL_PREFIX_TEMPLATE, { clinicName }),
        initialSuffix: INITIAL_SUFFIX,
        initial: buildInitialSmsBody(clinicName, config.initialMiddle),
      },
      limits: {
        maxAutoReplies: 3,
        maxInitialMiddleLength: MAX_INITIAL_MIDDLE_LENGTH,
        maxTemplateBodyLength: MAX_TEMPLATE_BODY_LENGTH,
      },
      variables: SUPPORTED_TEMPLATE_VARIABLES,
    });
  } catch {
    return jsonError(500, "load_failed", "We couldn't load the SMS settings. Please try again.");
  }
}

type FollowUpInput = { body?: unknown; enabled?: unknown };

// POST /api/admin/clinics/[clinicId]/sms-conversation
// Saves the initial middle, follow-up bodies + enabled flags, and max replies.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
): Promise<NextResponse> {
  const { clinicId } = await ctx.params;
  const guard = await requirePlatformAdminClinic(req, clinicId);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const input = (body ?? {}) as Record<string, unknown>;

  // Max auto-replies (0..3).
  const maxRaw = input.maxAutoReplies;
  if (typeof maxRaw !== "number" || !Number.isInteger(maxRaw) || maxRaw < 0 || maxRaw > 3) {
    return jsonBadRequest("Choose between 0 and 3 automated replies.");
  }
  const maxAutoReplies = maxRaw;

  // Initial middle (empty => default).
  const initial = validateInitialMiddle(input.initialMiddle);
  if (!initial.ok) return jsonBadRequest(initial.message);

  // Follow-ups.
  const rawFollowUps = (input.followUps ?? {}) as Record<string, FollowUpInput>;
  const followUps: Record<FollowUpSlot, { body: string | null; enabled: boolean }> = {
    1: { body: null, enabled: false },
    2: { body: null, enabled: false },
    3: { body: null, enabled: false },
  };
  for (const slot of SLOTS) {
    const raw = rawFollowUps[String(slot)] ?? rawFollowUps[slot as unknown as string] ?? {};
    const enabled = raw.enabled === true;
    const validated = validateFollowUpBody(raw.body);
    if (!validated.ok) return jsonBadRequest(`Follow-up #${slot}: ${validated.message}`);
    followUps[slot] = { body: validated.value.length > 0 ? validated.value : null, enabled };
  }

  // max_auto_replies cannot exceed the configured, enabled follow-up slots: for
  // every slot 1..max the follow-up must be enabled and non-empty.
  for (const slot of SLOTS) {
    if (slot > maxAutoReplies) break;
    const fu = followUps[slot];
    if (!fu.enabled || !(fu.body ?? "").trim()) {
      return jsonBadRequest(
        `Enable and write follow-up #${slot} before allowing ${maxAutoReplies} automated replies.`,
      );
    }
  }

  try {
    await saveClinicConversationConfig(
      clinicId,
      {
        initialMiddle: initial.value.length > 0 ? initial.value : null,
        maxAutoReplies,
        followUps,
      },
      { profileId: guard.admin.userId, email: guard.admin.email },
    );

    const enabledSlotCount = SLOTS.filter(
      (slot) => followUps[slot].enabled && (followUps[slot].body ?? "").trim().length > 0,
    ).length;
    try {
      await recordAdminAuditEvent({
        adminUserId: guard.admin.userId,
        adminEmail: guard.admin.email,
        action: "clinic.sms_conversation.update",
        targetType: "clinic",
        targetId: clinicId,
        clinicId,
        metadata: {
          max_auto_replies: maxAutoReplies,
          enabled_slot_count: enabledSlotCount,
          initial_customized: initial.value.length > 0,
          authSource: guard.admin.source,
        },
      });
    } catch {
      // never fail the save on audit hiccup
    }

    // Return the refreshed config + previews (same shape as GET).
    const config = await getClinicConversationConfig(clinicId);
    const clinicName = guard.clinic.name;
    return jsonOk({
      ok: true,
      clinicName,
      config: {
        initialMiddle: config.initialMiddle,
        defaultInitialMiddle: DEFAULT_INITIAL_MIDDLE,
        maxAutoReplies: config.maxAutoReplies,
        followUps: Object.fromEntries(
          SLOTS.map((slot) => [
            slot,
            {
              body: config.followUps[slot]?.body ?? null,
              enabled: config.followUps[slot]?.enabled ?? false,
              suggestion: DEFAULT_FOLLOW_UP_SUGGESTIONS[slot],
              preview: renderConversationTemplate(
                followUpBodyForSlot(config, slot) ?? DEFAULT_FOLLOW_UP_SUGGESTIONS[slot],
                { clinicName, patientName: PREVIEW_PATIENT_NAME },
              ),
            },
          ]),
        ),
      },
      preview: {
        initialPrefix: renderConversationTemplate(INITIAL_PREFIX_TEMPLATE, { clinicName }),
        initialSuffix: INITIAL_SUFFIX,
        initial: buildInitialSmsBody(clinicName, config.initialMiddle),
      },
    });
  } catch {
    return jsonError(500, "save_failed", "We couldn't save the SMS settings. Please try again.");
  }
}
