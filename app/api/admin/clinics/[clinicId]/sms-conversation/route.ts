import { type NextRequest, type NextResponse } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../../../lib/http/responses";
import { requirePlatformAdminClinic } from "../../../../../../lib/auth/admin-clinic";
import {
  getClinicConversationConfig,
  saveClinicConversationConfig,
} from "../../../../../../lib/db/sms-conversation-settings";
import {
  buildInitialSmsBody,
  DEFAULT_FOLLOW_UP_TEMPLATES,
  DEFAULT_INITIAL_TEMPLATE,
  effectiveFollowUpTemplate,
  effectiveInitialTemplate,
  isDefaultFollowUpTemplate,
  isDefaultInitialTemplate,
  MAX_INITIAL_TEMPLATE_LENGTH,
  MAX_TEMPLATE_BODY_LENGTH,
  renderConversationTemplate,
  sameTemplateText,
  SUPPORTED_TEMPLATE_VARIABLES,
  type ConversationTemplateConfig,
  type FollowUpSlot,
} from "../../../../../../lib/sms-recovery/conversation-templates";
import {
  validateFollowUpBody,
  validateInitialTemplate,
  validateVoiceGreetingTemplate,
} from "../../../../../../lib/sms-recovery/template-safety";
import {
  DEFAULT_VOICE_GREETING_TEMPLATES,
  MAX_VOICE_GREETING_TEMPLATE_LENGTH,
  VOICE_GREETING_HELPERS,
  VOICE_GREETING_LABELS,
  VOICE_GREETING_SCENARIOS,
  renderVoiceGreetingTemplate,
  type VoiceGreetingScenario,
} from "../../../../../../lib/sms-recovery/voice-greeting-templates";
import { recordAdminAuditEvent } from "../../../../../../lib/db/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLOTS: FollowUpSlot[] = [1, 2, 3];
// Sample name used only for follow-up previews ({{patient_name}}).
const PREVIEW_PATIENT_NAME = "Alex";

function buildConversationResponse(
  clinicName: string,
  config: ConversationTemplateConfig,
) {
  const followUps = Object.fromEntries(
    SLOTS.map((slot) => {
      const body = config.followUps[slot]?.body ?? null;
      const enabled = config.followUps[slot]?.enabled ?? false;
      const defaultText = DEFAULT_FOLLOW_UP_TEMPLATES[slot];
      const effectiveText = effectiveFollowUpTemplate(slot, body);
      return [
        slot,
        {
          customBody: body,
          defaultText,
          effectiveText,
          isCustom: (body ?? "").trim().length > 0,
          enabled,
          preview: renderConversationTemplate(effectiveText, {
            clinicName,
            patientName: PREVIEW_PATIENT_NAME,
          }),
        },
      ];
    }),
  );

  const voiceGreetings = Object.fromEntries(
    VOICE_GREETING_SCENARIOS.map((scenario) => {
      const body = config.voiceGreetings[scenario]?.body ?? null;
      const defaultText = DEFAULT_VOICE_GREETING_TEMPLATES[scenario];
      const effectiveText = (body ?? "").trim().length > 0 ? body! : defaultText;
      return [
        scenario,
        {
          defaultText,
          effectiveText,
          customBody: body,
          isCustom: (body ?? "").trim().length > 0,
          label: VOICE_GREETING_LABELS[scenario],
          helper: VOICE_GREETING_HELPERS[scenario],
          preview: renderVoiceGreetingTemplate(effectiveText, { clinicName }),
        },
      ];
    }),
  );

  const initialEffectiveText = effectiveInitialTemplate(config.initialTemplate);

  return {
    ok: true,
    clinicName,
    config: {
      initial: {
        defaultText: DEFAULT_INITIAL_TEMPLATE,
        effectiveText: initialEffectiveText,
        customBody: config.initialTemplate,
        isCustom: (config.initialTemplate ?? "").trim().length > 0,
        preview: buildInitialSmsBody(clinicName, config.initialTemplate),
      },
      maxAutoReplies: config.maxAutoReplies,
      followUps,
      voiceGreetings,
    },
    preview: {
      initial: buildInitialSmsBody(clinicName, config.initialTemplate),
      followUps: Object.fromEntries(
        SLOTS.map((slot) => [
          slot,
          renderConversationTemplate(effectiveFollowUpTemplate(slot, config.followUps[slot]?.body), {
            clinicName,
            patientName: PREVIEW_PATIENT_NAME,
          }),
        ]),
      ),
      voiceGreetings: Object.fromEntries(
        VOICE_GREETING_SCENARIOS.map((scenario) => [
          scenario,
          renderVoiceGreetingTemplate(
            config.voiceGreetings[scenario]?.body ?? DEFAULT_VOICE_GREETING_TEMPLATES[scenario],
            { clinicName },
          ),
        ]),
      ),
    },
    limits: {
      maxAutoReplies: 3,
      maxInitialTemplateLength: MAX_INITIAL_TEMPLATE_LENGTH,
      maxTemplateBodyLength: MAX_TEMPLATE_BODY_LENGTH,
      maxVoiceGreetingTemplateLength: MAX_VOICE_GREETING_TEMPLATE_LENGTH,
    },
    variables: SUPPORTED_TEMPLATE_VARIABLES,
    voiceVariables: ["clinic_name"],
  };
}

// GET /api/admin/clinics/[clinicId]/sms-conversation
// Returns saved custom bodies, effective active text, defaults, previews, and limits.
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
    return jsonOk(buildConversationResponse(clinicName, config));
  } catch {
    return jsonError(500, "load_failed", "We couldn't load the SMS settings. Please try again.");
  }
}

type FollowUpInput = {
  body?: unknown;
  customBody?: unknown;
  effectiveText?: unknown;
  enabled?: unknown;
};
type VoiceGreetingInput = {
  body?: unknown;
  customBody?: unknown;
  effectiveText?: unknown;
};

// POST /api/admin/clinics/[clinicId]/sms-conversation
// Saves the full initial template, follow-up bodies + enabled flags, and max replies.
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

  // Initial full template (empty/default => current code default).
  const rawInitial = pickTemplateText(input, "initialTemplate", "initial");
  const initial = validateInitialTemplate(rawInitial, guard.clinic.name);
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
    const validated = validateFollowUpBody(pickTemplateText(raw as Record<string, unknown>, "body"));
    if (!validated.ok) return jsonBadRequest(`Follow-up #${slot}: ${validated.message}`);
    followUps[slot] = { body: validated.value.length > 0 ? validated.value : null, enabled };
  }

  // max_auto_replies cannot exceed the configured, enabled follow-up slots. A
  // null/empty body is default-backed and still usable when enabled.
  for (const slot of SLOTS) {
    if (slot > maxAutoReplies) break;
    const fu = followUps[slot];
    if (!fu.enabled) {
      return jsonBadRequest(
        `Enable follow-up #${slot} before allowing ${maxAutoReplies} automated replies.`,
      );
    }
  }

  const hasVoiceInput = Object.prototype.hasOwnProperty.call(input, "voiceGreetings");
  let voiceGreetings: Record<VoiceGreetingScenario, { body: string | null }>;
  if (hasVoiceInput) {
    const rawVoiceGreetings = (input.voiceGreetings ?? {}) as Record<string, VoiceGreetingInput>;
    voiceGreetings = emptyVoiceGreetings();
    for (const scenario of VOICE_GREETING_SCENARIOS) {
      const raw = rawVoiceGreetings[scenario] ?? {};
      const validated = validateVoiceGreetingTemplate(
        pickTemplateText(raw as Record<string, unknown>, "body"),
        scenario,
      );
      if (!validated.ok) {
        return jsonBadRequest(`${VOICE_GREETING_LABELS[scenario]} greeting: ${validated.message}`);
      }
      voiceGreetings[scenario] = {
        body: validated.value.length > 0 ? validated.value : null,
      };
    }
  } else {
    try {
      voiceGreetings = (await getClinicConversationConfig(clinicId)).voiceGreetings;
    } catch {
      voiceGreetings = emptyVoiceGreetings();
    }
  }

  try {
    await saveClinicConversationConfig(
      clinicId,
      {
        initialTemplate: initial.value.length > 0 ? initial.value : null,
        maxAutoReplies,
        followUps,
        voiceGreetings,
      },
      { profileId: guard.admin.userId, email: guard.admin.email },
    );

    const enabledSlotCount = SLOTS.filter((slot) => followUps[slot].enabled).length;
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
          initial_customized:
            initial.value.length > 0 && !isDefaultInitialTemplate(initial.value),
          follow_up_enabled_count: enabledSlotCount,
          follow_up_customized_count: SLOTS.filter(
            (slot) =>
              (followUps[slot].body ?? "").trim().length > 0 &&
              !isDefaultFollowUpTemplate(slot, followUps[slot].body),
          ).length,
          voice_customized_count: VOICE_GREETING_SCENARIOS.filter(
            (scenario) =>
              (voiceGreetings[scenario].body ?? "").trim().length > 0 &&
              !sameTemplateText(voiceGreetings[scenario].body, DEFAULT_VOICE_GREETING_TEMPLATES[scenario]),
          ).length,
        },
      });
    } catch {
      // never fail the save on audit hiccup
    }

    // Return the refreshed config + previews (same shape as GET).
    const config = await getClinicConversationConfig(clinicId);
    const clinicName = guard.clinic.name;
    return jsonOk(buildConversationResponse(clinicName, config));
  } catch {
    return jsonError(500, "save_failed", "We couldn't save the SMS settings. Please try again.");
  }
}

function emptyVoiceGreetings(): Record<VoiceGreetingScenario, { body: string | null }> {
  return {
    will_send: { body: null },
    duplicate: { body: null },
    none: { body: null },
  };
}

function pickTemplateText(
  input: Record<string, unknown>,
  directKey: string,
  nestedKey?: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(input, directKey)) return input[directKey];
  if (Object.prototype.hasOwnProperty.call(input, "customBody")) return input.customBody;
  if (Object.prototype.hasOwnProperty.call(input, "effectiveText")) return input.effectiveText;
  if (!nestedKey) return undefined;
  const nested = input[nestedKey];
  if (!nested || typeof nested !== "object") return undefined;
  return pickTemplateText(nested as Record<string, unknown>, "customBody") ??
    pickTemplateText(nested as Record<string, unknown>, "effectiveText");
}
