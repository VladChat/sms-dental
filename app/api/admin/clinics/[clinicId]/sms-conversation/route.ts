import { type NextRequest, type NextResponse } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../../../lib/http/responses";
import { requirePlatformAdminClinic } from "../../../../../../lib/auth/admin-clinic";
import {
  getClinicConversationConfig,
  saveClinicConversationConfig,
} from "../../../../../../lib/db/sms-conversation-settings";
import {
  AUTO_REPLY_SLOTS,
  buildInitialSmsBody,
  DEFAULT_INITIAL_TEMPLATE,
  defaultFollowUpTemplateForSlot,
  effectiveFollowUpTemplate,
  effectiveInitialTemplate,
  hasDefaultFollowUpTemplate,
  isDefaultFollowUpTemplate,
  isDefaultInitialTemplate,
  isDefaultSpecialReplyTemplate,
  MAX_AUTO_REPLIES,
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
  validateSafetyNoticeText,
  validateThanksReplyText,
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
import {
  DEFAULT_SPECIAL_REPLY_TEMPLATES,
  MAX_SPECIAL_REPLY_LENGTH,
  SPECIAL_REPLY_HELPERS,
  SPECIAL_REPLY_KEYS,
  SPECIAL_REPLY_LABELS,
  specialReplyTextForKey,
  type SpecialReplyKey,
} from "../../../../../../lib/sms-recovery/special-reply-templates";
import {
  AUTOMATION_VOLUME_BOUNDS,
  defaultAutomationVolumeSettings,
  isAutomationVolumeCustomized,
  resolveAutomationVolumeSettings,
  validateAutomationVolumeSettings,
} from "../../../../../../lib/sms-recovery/automation-volume-limits";
import { recordAdminAuditEvent } from "../../../../../../lib/db/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLOTS: readonly FollowUpSlot[] = AUTO_REPLY_SLOTS;
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
      const defaultText = defaultFollowUpTemplateForSlot(slot);
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

  // Special replies (safety notice prefix + thanks courtesy). No variables;
  // the effective text is the preview.
  const specialReplies = Object.fromEntries(
    SPECIAL_REPLY_KEYS.map((key) => {
      const body = config.specialReplies?.[key]?.body ?? null;
      const effectiveText = specialReplyTextForKey(config.specialReplies, key);
      return [
        key,
        {
          defaultText: DEFAULT_SPECIAL_REPLY_TEMPLATES[key],
          effectiveText,
          customBody: body,
          isCustom: (body ?? "").trim().length > 0,
          label: SPECIAL_REPLY_LABELS[key],
          helper: SPECIAL_REPLY_HELPERS[key],
          preview: effectiveText,
        },
      ];
    }),
  );

  const antiSpamEffective = resolveAutomationVolumeSettings(config.antiSpam);
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
      specialReplies,
      antiSpam: {
        ...antiSpamEffective,
        isCustom: isAutomationVolumeCustomized(config.antiSpam),
        defaults: defaultAutomationVolumeSettings(),
      },
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
      maxAutoReplies: MAX_AUTO_REPLIES,
      maxInitialTemplateLength: MAX_INITIAL_TEMPLATE_LENGTH,
      maxTemplateBodyLength: MAX_TEMPLATE_BODY_LENGTH,
      maxVoiceGreetingTemplateLength: MAX_VOICE_GREETING_TEMPLATE_LENGTH,
      maxSpecialReplyLength: MAX_SPECIAL_REPLY_LENGTH,
      antiSpamBounds: AUTOMATION_VOLUME_BOUNDS,
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
type SpecialReplyInput = {
  body?: unknown;
  customBody?: unknown;
  effectiveText?: unknown;
};

// POST /api/admin/clinics/[clinicId]/sms-conversation
// Partial-save aware: each subview submits only its own section(s)
// (voice: voiceGreetings; texts: initialTemplate + followUps + specialReplies;
// limits: maxAutoReplies + antiSpam). Missing sections are loaded from the
// saved config so saving one subview never resets another.
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
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);

  // Current saved config is the baseline for any section the request omits.
  let current: ConversationTemplateConfig;
  try {
    current = await getClinicConversationConfig(clinicId);
  } catch {
    return jsonError(500, "load_failed", "We couldn't load the SMS settings. Please try again.");
  }

  // Max auto-replies (0..10).
  let maxAutoReplies = current.maxAutoReplies;
  if (has("maxAutoReplies")) {
    const maxRaw = input.maxAutoReplies;
    if (
      typeof maxRaw !== "number" ||
      !Number.isInteger(maxRaw) ||
      maxRaw < 0 ||
      maxRaw > MAX_AUTO_REPLIES
    ) {
      return jsonBadRequest(`Choose between 0 and ${MAX_AUTO_REPLIES} automated replies.`);
    }
    maxAutoReplies = maxRaw;
  }

  // Initial full template (empty/default => current code default).
  let initialTemplate = current.initialTemplate;
  if (has("initialTemplate") || has("initial")) {
    const rawInitial = pickTemplateText(input, "initialTemplate", "initial");
    const initial = validateInitialTemplate(rawInitial, guard.clinic.name);
    if (!initial.ok) return jsonBadRequest(initial.message);
    initialTemplate = initial.value.length > 0 ? initial.value : null;
  }

  // Follow-ups.
  let followUps = current.followUps;
  if (has("followUps")) {
    const rawFollowUps = (input.followUps ?? {}) as Record<string, FollowUpInput>;
    followUps = emptyFollowUps();
    for (const slot of SLOTS) {
      const raw = rawFollowUps[String(slot)] ?? rawFollowUps[slot as unknown as string] ?? {};
      const enabled = raw.enabled === true;
      const validated = validateFollowUpBody(pickTemplateText(raw as Record<string, unknown>, "body"));
      if (!validated.ok) return jsonBadRequest(`Follow-up #${slot}: ${validated.message}`);
      const normalizedBody = validated.value.length > 0 ? validated.value : null;
      if (enabled && !normalizedBody && !hasDefaultFollowUpTemplate(slot)) {
        return jsonBadRequest(`Follow-up #${slot} needs custom text before it can be enabled.`);
      }
      followUps[slot] = { body: normalizedBody, enabled };
    }
  }

  // max_auto_replies cannot exceed the configured, enabled follow-up slots
  // (checked on the MERGED values so a limits-only save still validates against
  // the saved follow-ups). A null/empty body is default-backed only for 1-3.
  for (const slot of SLOTS) {
    if (slot > maxAutoReplies) break;
    const fu = followUps[slot];
    if (!fu.enabled) {
      return jsonBadRequest(
        `Enable follow-up #${slot} before allowing ${maxAutoReplies} automated replies.`,
      );
    }
    if (!fu.body && !hasDefaultFollowUpTemplate(slot)) {
      return jsonBadRequest(
        `Add custom text to follow-up #${slot} before allowing ${maxAutoReplies} automated replies.`,
      );
    }
  }

  // Voice greetings.
  let voiceGreetings = current.voiceGreetings;
  if (has("voiceGreetings")) {
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
  }

  // Special replies (safety notice / thanks courtesy).
  let specialReplies = currentSpecialReplies(current);
  if (has("specialReplies")) {
    const rawSpecial = (input.specialReplies ?? {}) as Record<string, SpecialReplyInput>;
    specialReplies = emptySpecialReplies();
    for (const key of SPECIAL_REPLY_KEYS) {
      const raw = rawSpecial[key] ?? {};
      const rawText = pickTemplateText(raw as Record<string, unknown>, "body");
      const validated =
        key === "safety_notice"
          ? validateSafetyNoticeText(rawText)
          : validateThanksReplyText(rawText);
      if (!validated.ok) {
        return jsonBadRequest(`${SPECIAL_REPLY_LABELS[key]}: ${validated.message}`);
      }
      specialReplies[key] = { body: validated.value.length > 0 ? validated.value : null };
    }
  }

  // Anti-spam thresholds (mute after / high-volume after / mute hours).
  // Missing fields fall back to the code defaults; present fields must be
  // valid integers inside the documented bounds, and the high-volume
  // threshold can never be below the mute threshold.
  let antiSpam = current.antiSpam ?? {};
  if (has("antiSpam")) {
    const rawAntiSpam = (input.antiSpam ?? {}) as Record<string, unknown>;
    const defaults = defaultAutomationVolumeSettings();
    const validated = validateAutomationVolumeSettings({
      unansweredMuteAfter: rawAntiSpam.unansweredMuteAfter ?? defaults.unansweredMuteAfter,
      unansweredHighVolumeAfter:
        rawAntiSpam.unansweredHighVolumeAfter ?? defaults.unansweredHighVolumeAfter,
      automationMuteHours: rawAntiSpam.automationMuteHours ?? defaults.automationMuteHours,
    });
    if (!validated.ok) return jsonBadRequest(validated.message);
    antiSpam = validated.value;
  }

  try {
    await saveClinicConversationConfig(
      clinicId,
      {
        initialTemplate,
        maxAutoReplies,
        followUps,
        voiceGreetings,
        specialReplies,
        antiSpam,
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
          changed_section: changedSection(has),
          max_auto_replies: maxAutoReplies,
          initial_customized:
            (initialTemplate ?? "").length > 0 && !isDefaultInitialTemplate(initialTemplate),
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
          special_reply_customized_count: SPECIAL_REPLY_KEYS.filter(
            (key) =>
              (specialReplies[key].body ?? "").trim().length > 0 &&
              !isDefaultSpecialReplyTemplate(key, specialReplies[key].body),
          ).length,
          anti_spam_customized: isAutomationVolumeCustomized(antiSpam),
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

// Compact audit label for which subview submitted (voice/texts/limits/mixed).
function changedSection(has: (key: string) => boolean): string {
  const sections: string[] = [];
  if (has("voiceGreetings")) sections.push("voice");
  if (has("initialTemplate") || has("followUps") || has("specialReplies")) sections.push("texts");
  if (has("maxAutoReplies") || has("antiSpam")) sections.push("limits");
  if (sections.length === 0) return "none";
  return sections.length === 1 ? sections[0]! : "mixed";
}

function currentSpecialReplies(
  config: ConversationTemplateConfig,
): Record<SpecialReplyKey, { body: string | null }> {
  return {
    safety_notice: { body: config.specialReplies?.safety_notice?.body ?? null },
    thanks_courtesy: { body: config.specialReplies?.thanks_courtesy?.body ?? null },
  };
}

function emptySpecialReplies(): Record<SpecialReplyKey, { body: string | null }> {
  return {
    safety_notice: { body: null },
    thanks_courtesy: { body: null },
  };
}

function emptyVoiceGreetings(): Record<VoiceGreetingScenario, { body: string | null }> {
  return {
    will_send: { body: null },
    duplicate: { body: null },
    none: { body: null },
  };
}

function emptyFollowUps(): Record<FollowUpSlot, { body: string | null; enabled: boolean }> {
  return Object.fromEntries(
    SLOTS.map((slot) => [slot, { body: null, enabled: false }]),
  ) as Record<FollowUpSlot, { body: string | null; enabled: boolean }>;
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
