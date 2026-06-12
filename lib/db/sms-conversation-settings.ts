import { getDb } from "./client";
import type {
  ConversationTemplateConfig,
  FollowUpSlot,
} from "../sms-recovery/conversation-templates";
import {
  AUTO_REPLY_SLOTS,
  defaultFollowUpTemplateForSlot,
  isDefaultFollowUpTemplate,
  isDefaultInitialTemplate,
  MAX_AUTO_REPLIES,
  normalizeTemplateBody,
  sameTemplateText,
} from "../sms-recovery/conversation-templates";
import {
  DEFAULT_VOICE_GREETING_TEMPLATES,
  defaultVoiceGreetingTemplateConfig,
  VOICE_GREETING_SCENARIO_BY_SEQUENCE,
  VOICE_GREETING_SEQUENCE_BY_SCENARIO,
  VOICE_GREETING_SCENARIOS,
  type VoiceGreetingScenario,
} from "../sms-recovery/voice-greeting-templates";
import {
  DEFAULT_SPECIAL_REPLY_TEMPLATES,
  defaultSpecialReplyTemplateConfig,
  SPECIAL_REPLY_KEY_BY_SEQUENCE,
  SPECIAL_REPLY_KEYS,
  SPECIAL_REPLY_SEQUENCE_BY_KEY,
  type SpecialReplyKey,
} from "../sms-recovery/special-reply-templates";
import {
  DEFAULT_AUTOMATION_MUTE_HOURS,
  DEFAULT_UNANSWERED_HIGH_VOLUME_AFTER,
  DEFAULT_UNANSWERED_MUTE_AFTER,
  type AutomationVolumeSettingsInput,
} from "../sms-recovery/automation-volume-limits";

// Clinic SMS conversation settings + message templates (admin-configured).
// No row -> safe defaults (max_auto_replies 0, no custom initial template,
// follow-ups disabled, anti-spam code defaults). A null body_text / null
// threshold column means "use the current code default". All reads/writes are
// clinic-scoped and service-role only.

type SettingsRow = {
  max_auto_replies: number;
  unanswered_mute_after: number | null;
  unanswered_high_volume_after: number | null;
  automation_mute_hours: number | null;
};
type TemplateRow = {
  template_role: "initial" | "auto_reply" | "voice_greeting" | "special_reply";
  sequence: number;
  body_text: string | null;
  enabled: boolean;
};

// Load the merged config for a clinic. Used by the admin builder API, the
// outbound initial-SMS builder, and the inbound auto-reply decision.
export async function getClinicConversationConfig(
  clinicId: string,
): Promise<ConversationTemplateConfig> {
  const sql = getDb();
  const [settingsRows, templateRows] = await Promise.all([
    sql<SettingsRow[]>`
      select max_auto_replies, unanswered_mute_after,
             unanswered_high_volume_after, automation_mute_hours
      from public.clinic_sms_conversation_settings
      where clinic_id = ${clinicId}
      limit 1
    `,
    sql<TemplateRow[]>`
      select template_role, sequence, body_text, enabled
      from public.clinic_sms_message_templates
      where clinic_id = ${clinicId}
    `,
  ]);

  const maxAutoReplies = clampMax(settingsRows[0]?.max_auto_replies ?? 0);
  const antiSpam: AutomationVolumeSettingsInput = {
    unansweredMuteAfter: settingsRows[0]?.unanswered_mute_after ?? null,
    unansweredHighVolumeAfter: settingsRows[0]?.unanswered_high_volume_after ?? null,
    automationMuteHours: settingsRows[0]?.automation_mute_hours ?? null,
  };
  let initialTemplate: string | null = null;
  const followUps = emptyFollowUps();
  const voiceGreetings = defaultVoiceGreetingTemplateConfig();
  const specialReplies = defaultSpecialReplyTemplateConfig();

  for (const row of templateRows) {
    if (row.template_role === "initial" && row.sequence === 0) {
      initialTemplate = normalizeTemplateBody(row.body_text);
    } else if (row.template_role === "auto_reply" && isAutoReplySlot(row.sequence)) {
      followUps[row.sequence as FollowUpSlot] = {
        body: normalizeTemplateBody(row.body_text),
        enabled: row.enabled,
      };
    } else if (row.template_role === "voice_greeting" && row.sequence >= 1 && row.sequence <= 3) {
      const scenario = VOICE_GREETING_SCENARIO_BY_SEQUENCE[row.sequence as 1 | 2 | 3];
      voiceGreetings[scenario] = {
        body: normalizeTemplateBody(row.body_text),
      };
    } else if (row.template_role === "special_reply" && (row.sequence === 1 || row.sequence === 2)) {
      const key = SPECIAL_REPLY_KEY_BY_SEQUENCE[row.sequence as 1 | 2];
      specialReplies[key] = { body: normalizeTemplateBody(row.body_text) };
    }
  }

  return { initialTemplate, maxAutoReplies, followUps, voiceGreetings, specialReplies, antiSpam };
}

export type SaveConversationConfigInput = {
  initialTemplate: string | null; // null/empty/default => current code default
  maxAutoReplies: number; // 0..10 (clamped)
  followUps: Record<FollowUpSlot, { body: string | null; enabled: boolean }>;
  voiceGreetings: Record<VoiceGreetingScenario, { body: string | null }>;
  // Optional: missing means "no special reply overrides" (defaults). Bodies
  // equal to the code default are stored as deletes, like other templates.
  specialReplies?: Record<SpecialReplyKey, { body: string | null }>;
  // Optional anti-spam thresholds; values equal to the code defaults are
  // stored as NULL columns so code defaults stay the source of truth.
  antiSpam?: AutomationVolumeSettingsInput;
};

export type ConversationTemplateStorageRow = {
  role: "initial" | "auto_reply" | "voice_greeting" | "special_reply";
  sequence: number;
  body: string | null;
  enabled: boolean;
};

export type ConversationTemplateDeleteKey = {
  role: "initial" | "auto_reply" | "voice_greeting" | "special_reply";
  sequence: number;
};

export type PreparedConversationTemplateStorage = {
  maxAutoReplies: number;
  keepSettingsRow: boolean;
  // Column values for the settings row; null means "use the code default".
  antiSpam: {
    unansweredMuteAfter: number | null;
    unansweredHighVolumeAfter: number | null;
    automationMuteHours: number | null;
  };
  upsertRows: ConversationTemplateStorageRow[];
  deleteRows: ConversationTemplateDeleteKey[];
};

export function prepareConversationTemplateStorage(
  input: SaveConversationConfigInput,
): PreparedConversationTemplateStorage {
  const maxAutoReplies = clampMax(input.maxAutoReplies);
  const upsertRows: ConversationTemplateStorageRow[] = [];
  const deleteRows: ConversationTemplateDeleteKey[] = [];

  const initialBody = customOrNull(
    normalizeTemplateBody(input.initialTemplate),
    isDefaultInitialTemplate,
  );
  if (initialBody) {
    upsertRows.push({ role: "initial", sequence: 0, body: initialBody, enabled: true });
  } else {
    deleteRows.push({ role: "initial", sequence: 0 });
  }

  for (const slot of AUTO_REPLY_SLOTS) {
    const incoming = input.followUps[slot] ?? { body: null, enabled: false };
    const customBody = customOrNull(
      normalizeTemplateBody(incoming.body),
      (body) => isDefaultFollowUpTemplate(slot, body),
    );
    const hasUsableBody = customBody !== null || defaultFollowUpTemplateForSlot(slot) !== null;
    const enabled = incoming.enabled && hasUsableBody;
    if (enabled || customBody) {
      upsertRows.push({
        role: "auto_reply",
        sequence: slot,
        body: customBody,
        enabled,
      });
    } else {
      deleteRows.push({ role: "auto_reply", sequence: slot });
    }
  }

  for (const scenario of VOICE_GREETING_SCENARIOS) {
    const sequence = VOICE_GREETING_SEQUENCE_BY_SCENARIO[scenario];
    const customBody = customOrNull(
      normalizeTemplateBody(input.voiceGreetings[scenario].body),
      (body) => sameTemplateText(body, DEFAULT_VOICE_GREETING_TEMPLATES[scenario]),
    );
    if (customBody) {
      upsertRows.push({ role: "voice_greeting", sequence, body: customBody, enabled: true });
    } else {
      deleteRows.push({ role: "voice_greeting", sequence });
    }
  }

  // Special replies (safety notice / thanks courtesy): only true custom text
  // is stored; default-equal or blank text removes the override row.
  for (const key of SPECIAL_REPLY_KEYS) {
    const sequence = SPECIAL_REPLY_SEQUENCE_BY_KEY[key];
    const customBody = customOrNull(
      normalizeTemplateBody(input.specialReplies?.[key]?.body ?? null),
      (body) => sameTemplateText(body, DEFAULT_SPECIAL_REPLY_TEMPLATES[key]),
    );
    if (customBody) {
      upsertRows.push({ role: "special_reply", sequence, body: customBody, enabled: true });
    } else {
      deleteRows.push({ role: "special_reply", sequence });
    }
  }

  // Anti-spam columns: store NULL when equal to the code default.
  const antiSpam = {
    unansweredMuteAfter: settingOrNull(
      input.antiSpam?.unansweredMuteAfter,
      DEFAULT_UNANSWERED_MUTE_AFTER,
    ),
    unansweredHighVolumeAfter: settingOrNull(
      input.antiSpam?.unansweredHighVolumeAfter,
      DEFAULT_UNANSWERED_HIGH_VOLUME_AFTER,
    ),
    automationMuteHours: settingOrNull(
      input.antiSpam?.automationMuteHours,
      DEFAULT_AUTOMATION_MUTE_HOURS,
    ),
  };
  const antiSpamCustomized =
    antiSpam.unansweredMuteAfter !== null ||
    antiSpam.unansweredHighVolumeAfter !== null ||
    antiSpam.automationMuteHours !== null;

  return {
    maxAutoReplies,
    // The settings row must survive whenever it carries meaning: a non-zero
    // max OR custom anti-spam thresholds.
    keepSettingsRow: maxAutoReplies > 0 || antiSpamCustomized,
    antiSpam,
    upsertRows,
    deleteRows,
  };
}

// Upsert meaningful settings/template rows and delete rows that only restate
// code defaults. Caller validates all text (template-safety) before calling this.
export async function saveClinicConversationConfig(
  clinicId: string,
  input: SaveConversationConfigInput,
  actor: { profileId: string | null; email: string | null },
): Promise<void> {
  const sql = getDb();
  const storage = prepareConversationTemplateStorage(input);
  await sql.begin(async (tx) => {
    if (storage.keepSettingsRow) {
      await tx`
        insert into public.clinic_sms_conversation_settings
          (clinic_id, max_auto_replies, unanswered_mute_after,
           unanswered_high_volume_after, automation_mute_hours,
           updated_by_profile_id, updated_by_email)
        values (${clinicId}, ${storage.maxAutoReplies},
                ${storage.antiSpam.unansweredMuteAfter},
                ${storage.antiSpam.unansweredHighVolumeAfter},
                ${storage.antiSpam.automationMuteHours},
                ${actor.profileId}, ${actor.email})
        on conflict (clinic_id) do update set
          max_auto_replies = excluded.max_auto_replies,
          unanswered_mute_after = excluded.unanswered_mute_after,
          unanswered_high_volume_after = excluded.unanswered_high_volume_after,
          automation_mute_hours = excluded.automation_mute_hours,
          updated_by_profile_id = excluded.updated_by_profile_id,
          updated_by_email = excluded.updated_by_email
      `;
    } else {
      await tx`
        delete from public.clinic_sms_conversation_settings
        where clinic_id = ${clinicId}
      `;
    }

    for (const row of storage.deleteRows) {
      await tx`
        delete from public.clinic_sms_message_templates
        where clinic_id = ${clinicId}
          and template_role = ${row.role}
          and sequence = ${row.sequence}
      `;
    }

    for (const row of storage.upsertRows) {
      await tx`
        insert into public.clinic_sms_message_templates
          (clinic_id, template_role, sequence, body_text, enabled,
           updated_by_profile_id, updated_by_email)
        values (${clinicId}, ${row.role}, ${row.sequence}, ${row.body}, ${row.enabled},
                ${actor.profileId}, ${actor.email})
        on conflict (clinic_id, template_role, sequence) do update set
          body_text = excluded.body_text,
          enabled = excluded.enabled,
          updated_by_profile_id = excluded.updated_by_profile_id,
          updated_by_email = excluded.updated_by_email
      `;
    }
  });
}

function customOrNull(
  body: string | null,
  isDefault: (body: string) => boolean,
): string | null {
  if (!body) return null;
  return isDefault(body) ? null : body;
}

// Store NULL when the submitted value is missing or equals the code default.
function settingOrNull(value: number | null | undefined, defaultValue: number): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  const normalized = Math.trunc(value);
  return normalized === defaultValue ? null : normalized;
}

function clampMax(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_AUTO_REPLIES, Math.trunc(value)));
}

function emptyFollowUps(): ConversationTemplateConfig["followUps"] {
  return Object.fromEntries(
    AUTO_REPLY_SLOTS.map((slot) => [slot, { body: null, enabled: false }]),
  ) as ConversationTemplateConfig["followUps"];
}

function isAutoReplySlot(value: number): value is FollowUpSlot {
  return (AUTO_REPLY_SLOTS as readonly number[]).includes(value);
}
