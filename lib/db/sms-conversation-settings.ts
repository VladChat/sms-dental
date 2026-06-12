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

// Clinic SMS conversation settings + message templates (admin-configured).
// No row -> safe defaults (max_auto_replies 0, no custom initial template,
// follow-ups disabled). A null body_text means "use the current code default".
// All reads/writes are clinic-scoped and service-role only.

type SettingsRow = { max_auto_replies: number };
type TemplateRow = {
  template_role: "initial" | "auto_reply" | "voice_greeting";
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
      select max_auto_replies
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
  let initialTemplate: string | null = null;
  const followUps = emptyFollowUps();
  const voiceGreetings = defaultVoiceGreetingTemplateConfig();

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
    }
  }

  return { initialTemplate, maxAutoReplies, followUps, voiceGreetings };
}

export type SaveConversationConfigInput = {
  initialTemplate: string | null; // null/empty/default => current code default
  maxAutoReplies: number; // 0..10 (clamped)
  followUps: Record<FollowUpSlot, { body: string | null; enabled: boolean }>;
  voiceGreetings: Record<VoiceGreetingScenario, { body: string | null }>;
};

export type ConversationTemplateStorageRow = {
  role: "initial" | "auto_reply" | "voice_greeting";
  sequence: number;
  body: string | null;
  enabled: boolean;
};

export type ConversationTemplateDeleteKey = {
  role: "initial" | "auto_reply" | "voice_greeting";
  sequence: number;
};

export type PreparedConversationTemplateStorage = {
  maxAutoReplies: number;
  keepSettingsRow: boolean;
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

  return {
    maxAutoReplies,
    keepSettingsRow: maxAutoReplies > 0,
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
          (clinic_id, max_auto_replies, updated_by_profile_id, updated_by_email)
        values (${clinicId}, ${storage.maxAutoReplies}, ${actor.profileId}, ${actor.email})
        on conflict (clinic_id) do update set
          max_auto_replies = excluded.max_auto_replies,
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
