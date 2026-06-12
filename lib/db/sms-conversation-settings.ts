import { getDb } from "./client";
import type {
  ConversationTemplateConfig,
  FollowUpSlot,
} from "../sms-recovery/conversation-templates";
import {
  defaultVoiceGreetingTemplateConfig,
  VOICE_GREETING_SCENARIO_BY_SEQUENCE,
  VOICE_GREETING_SEQUENCE_BY_SCENARIO,
  VOICE_GREETING_SCENARIOS,
  type VoiceGreetingScenario,
} from "../sms-recovery/voice-greeting-templates";

// Clinic SMS conversation settings + message templates (admin-configured).
// No row -> safe defaults (max_auto_replies 0, no custom initial template,
// follow-ups disabled). All reads/writes are clinic-scoped and service-role only.

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
  const followUps: ConversationTemplateConfig["followUps"] = {
    1: { body: null, enabled: false },
    2: { body: null, enabled: false },
    3: { body: null, enabled: false },
  };
  const voiceGreetings = defaultVoiceGreetingTemplateConfig();

  for (const row of templateRows) {
    if (row.template_role === "initial" && row.sequence === 0) {
      const body = (row.body_text ?? "").trim();
      initialTemplate = body.length > 0 ? body : null;
    } else if (row.template_role === "auto_reply" && row.sequence >= 1 && row.sequence <= 3) {
      followUps[row.sequence as FollowUpSlot] = {
        body: row.body_text ?? null,
        enabled: row.enabled,
      };
    } else if (row.template_role === "voice_greeting" && row.sequence >= 1 && row.sequence <= 3) {
      const scenario = VOICE_GREETING_SCENARIO_BY_SEQUENCE[row.sequence as 1 | 2 | 3];
      voiceGreetings[scenario] = {
        body: normalizeBody(row.body_text),
      };
    }
  }

  return { initialTemplate, maxAutoReplies, followUps, voiceGreetings };
}

export type SaveConversationConfigInput = {
  initialTemplate: string | null; // null/empty => fixed default initial template
  maxAutoReplies: number; // 0..3 (clamped)
  followUps: Record<FollowUpSlot, { body: string | null; enabled: boolean }>;
  voiceGreetings: Record<VoiceGreetingScenario, { body: string | null }>;
};

// Upsert settings + all template slots in one transaction. Caller validates all
// text (template-safety) before calling this.
export async function saveClinicConversationConfig(
  clinicId: string,
  input: SaveConversationConfigInput,
  actor: { profileId: string | null; email: string | null },
): Promise<void> {
  const sql = getDb();
  const maxAutoReplies = clampMax(input.maxAutoReplies);
  const rows: {
    role: "initial" | "auto_reply" | "voice_greeting";
    sequence: number;
    body: string | null;
    enabled: boolean;
  }[] = [
    { role: "initial", sequence: 0, body: normalizeBody(input.initialTemplate), enabled: true },
    { role: "auto_reply", sequence: 1, body: normalizeBody(input.followUps[1].body), enabled: input.followUps[1].enabled },
    { role: "auto_reply", sequence: 2, body: normalizeBody(input.followUps[2].body), enabled: input.followUps[2].enabled },
    { role: "auto_reply", sequence: 3, body: normalizeBody(input.followUps[3].body), enabled: input.followUps[3].enabled },
    ...VOICE_GREETING_SCENARIOS.map((scenario) => ({
      role: "voice_greeting" as const,
      sequence: VOICE_GREETING_SEQUENCE_BY_SCENARIO[scenario],
      body: normalizeBody(input.voiceGreetings[scenario].body),
      enabled: true,
    })),
  ];
  await sql.begin(async (tx) => {
    await tx`
      insert into public.clinic_sms_conversation_settings
        (clinic_id, max_auto_replies, updated_by_profile_id, updated_by_email)
      values (${clinicId}, ${maxAutoReplies}, ${actor.profileId}, ${actor.email})
      on conflict (clinic_id) do update set
        max_auto_replies = excluded.max_auto_replies,
        updated_by_profile_id = excluded.updated_by_profile_id,
        updated_by_email = excluded.updated_by_email
    `;
    for (const row of rows) {
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

function normalizeBody(body: string | null): string | null {
  const trimmed = (body ?? "").replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clampMax(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(3, Math.trunc(value)));
}
