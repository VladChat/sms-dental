import { type NextRequest, type NextResponse } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../../../lib/http/responses";
import { requirePlatformAdminClinic } from "../../../../../../lib/auth/admin-clinic";
import {
  getClinicConversationConfig,
  saveClinicConversationConfig,
} from "../../../../../../lib/db/sms-conversation-settings";
import {
  buildInitialSmsBody,
  DEFAULT_INITIAL_TEMPLATE,
  DEFAULT_FOLLOW_UP_SUGGESTIONS,
  initialTemplateForEditor,
  MAX_INITIAL_TEMPLATE_LENGTH,
  MAX_TEMPLATE_BODY_LENGTH,
  renderConversationTemplate,
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

  const voiceGreetings = Object.fromEntries(
    VOICE_GREETING_SCENARIOS.map((scenario) => {
      const body = config.voiceGreetings[scenario]?.body ?? null;
      const defaultText = DEFAULT_VOICE_GREETING_TEMPLATES[scenario];
      const previewSource = (body ?? "").trim().length > 0 ? body! : defaultText;
      return [
        scenario,
        {
          body,
          defaultText,
          suggestion: defaultText,
          label: VOICE_GREETING_LABELS[scenario],
          helper: VOICE_GREETING_HELPERS[scenario],
          preview: renderVoiceGreetingTemplate(previewSource, { clinicName }),
        },
      ];
    }),
  );

  return {
    ok: true,
    clinicName,
    config: {
      initialTemplate: initialTemplateForEditor(config.initialTemplate, clinicName),
      defaultInitialTemplate: DEFAULT_INITIAL_TEMPLATE,
      maxAutoReplies: config.maxAutoReplies,
      followUps,
      voiceGreetings,
    },
    preview: {
      initial: buildInitialSmsBody(clinicName, config.initialTemplate),
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
    return jsonOk(buildConversationResponse(clinicName, config));
  } catch {
    return jsonError(500, "load_failed", "We couldn't load the SMS settings. Please try again.");
  }
}

type FollowUpInput = { body?: unknown; enabled?: unknown };
type VoiceGreetingInput = { body?: unknown };

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

  // Initial full template (empty => fixed default). `initialMiddle` is accepted
  // only for compatibility with the first builder implementation.
  const rawInitial =
    Object.prototype.hasOwnProperty.call(input, "initialTemplate")
      ? input.initialTemplate
      : legacyMiddleToFullTemplate(input.initialMiddle);
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

  const hasVoiceInput = Object.prototype.hasOwnProperty.call(input, "voiceGreetings");
  let voiceGreetings: Record<VoiceGreetingScenario, { body: string | null }>;
  if (hasVoiceInput) {
    const rawVoiceGreetings = (input.voiceGreetings ?? {}) as Record<string, VoiceGreetingInput>;
    voiceGreetings = emptyVoiceGreetings();
    for (const scenario of VOICE_GREETING_SCENARIOS) {
      const raw = rawVoiceGreetings[scenario] ?? {};
      const validated = validateVoiceGreetingTemplate(raw.body, scenario);
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
          initial_customized:
            initial.value.length > 0 && initial.value !== DEFAULT_INITIAL_TEMPLATE,
          follow_up_enabled_count: enabledSlotCount,
          voice_customized_count: VOICE_GREETING_SCENARIOS.filter(
            (scenario) => (voiceGreetings[scenario].body ?? "").trim().length > 0,
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

function legacyMiddleToFullTemplate(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const middle = raw.replace(/\s+/g, " ").trim();
  if (!middle) return "";
  return `Hi, this is {{clinic_name}}. ${middle} Reply STOP to opt out.`;
}

function emptyVoiceGreetings(): Record<VoiceGreetingScenario, { body: string | null }> {
  return {
    will_send: { body: null },
    duplicate: { body: null },
    none: { body: null },
  };
}
