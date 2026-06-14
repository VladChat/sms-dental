import { AI_ANSWERING_TEST_CALLER } from "../../config/test-callers.config";
import { getDb } from "./client";

export type TestCallerResetCounts = {
  aiVoiceSessions: number;
  messages: number;
  patientConversations: number;
  callEvents: number;
  optOuts: number;
  clinicBlockedPatientNumbers: number;
};

export type TestCallerResetResult = {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  maskedPhone: string;
  counts: TestCallerResetCounts;
};

export type TestCallerResetValidationResult =
  | { ok: true }
  | { ok: false; status: 400 | 403; code: string; message: string };

export class TestCallerResetValidationError extends Error {
  status: 400 | 403;
  code: string;

  constructor(result: Extract<TestCallerResetValidationResult, { ok: false }>) {
    super(result.message);
    this.name = "TestCallerResetValidationError";
    this.status = result.status;
    this.code = result.code;
  }
}

export function validateAiAnsweringTestCallerResetInput(input: {
  clinicId: string;
  patientPhone: string;
  confirm: string;
}): TestCallerResetValidationResult {
  const clinicId = input.clinicId.trim();
  const patientPhone = input.patientPhone.trim();
  const confirm = input.confirm.trim();

  if (confirm !== AI_ANSWERING_TEST_CALLER.resetConfirm) {
    return {
      ok: false,
      status: 400,
      code: "confirmation_required",
      message: `Type ${AI_ANSWERING_TEST_CALLER.resetConfirm} to confirm this reset.`,
    };
  }

  if (clinicId !== AI_ANSWERING_TEST_CALLER.clinicId) {
    return {
      ok: false,
      status: 403,
      code: "clinic_not_allowed",
      message: "This reset is only available for the configured AI Answering test clinic.",
    };
  }

  if (patientPhone !== AI_ANSWERING_TEST_CALLER.patientPhone) {
    return {
      ok: false,
      status: 400,
      code: "caller_not_allowed",
      message: "This reset only clears the configured test caller.",
    };
  }

  return { ok: true };
}

export async function resetAiAnsweringTestCaller(input: {
  clinicId: string;
  patientPhone: string;
  confirm: string;
}): Promise<TestCallerResetResult> {
  const validation = validateAiAnsweringTestCallerResetInput(input);
  if (!validation.ok) throw new TestCallerResetValidationError(validation);

  const clinicId = AI_ANSWERING_TEST_CALLER.clinicId;
  const phone = AI_ANSWERING_TEST_CALLER.patientPhone;
  const sql = getDb();

  const counts = await sql.begin(async (tx): Promise<TestCallerResetCounts> => {
    const aiVoiceSessions = await tx<{ id: string }[]>`
      delete from public.ai_voice_sessions s
      where s.clinic_id = ${clinicId}
        and (
          s.patient_phone = ${phone}
          or exists (
            select 1
            from public.patient_conversations c
            where c.id = s.conversation_id
              and c.clinic_id = ${clinicId}
              and c.patient_phone = ${phone}
          )
        )
      returning id
    `;

    const messages = await tx<{ id: string }[]>`
      delete from public.messages m
      where m.clinic_id = ${clinicId}
        and (
          m.from_number = ${phone}
          or m.to_number = ${phone}
          or exists (
            select 1
            from public.patient_conversations c
            where c.id = m.conversation_id
              and c.clinic_id = ${clinicId}
              and c.patient_phone = ${phone}
          )
        )
      returning id
    `;

    const patientConversations = await tx<{ id: string }[]>`
      delete from public.patient_conversations
      where clinic_id = ${clinicId}
        and patient_phone = ${phone}
      returning id
    `;

    const callEvents = await tx<{ id: string }[]>`
      delete from public.call_events
      where clinic_id = ${clinicId}
        and (from_number = ${phone} or to_number = ${phone})
      returning id
    `;

    const optOuts = await tx<{ id: string }[]>`
      delete from public.opt_outs
      where clinic_id = ${clinicId}
        and phone_number = ${phone}
      returning id
    `;

    const clinicBlockedPatientNumbers = await tx<{ id: string }[]>`
      delete from public.clinic_blocked_patient_numbers
      where clinic_id = ${clinicId}
        and phone_number = ${phone}
      returning id
    `;

    return {
      aiVoiceSessions: aiVoiceSessions.length,
      messages: messages.length,
      patientConversations: patientConversations.length,
      callEvents: callEvents.length,
      optOuts: optOuts.length,
      clinicBlockedPatientNumbers: clinicBlockedPatientNumbers.length,
    };
  });

  return {
    clinicId,
    clinicName: AI_ANSWERING_TEST_CALLER.clinicName,
    clinicSlug: AI_ANSWERING_TEST_CALLER.clinicSlug,
    maskedPhone: AI_ANSWERING_TEST_CALLER.patientPhoneMasked,
    counts,
  };
}
