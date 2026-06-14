import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonOk,
} from "../../../../../../../lib/http/responses";
import { requirePlatformAdminClinic } from "../../../../../../../lib/auth/admin-clinic";
import {
  resetAiAnsweringTestCaller,
  TestCallerResetValidationError,
} from "../../../../../../../lib/db/test-caller-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ResetTestCallerSchema = z.object({
  patientPhone: z.string().trim().min(1),
  confirm: z.string().trim().min(1),
}).strict();

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
    return jsonBadRequest("Invalid request body.");
  }

  const parsed = ResetTestCallerSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid request.";
    return jsonBadRequest(first);
  }

  try {
    const result = await resetAiAnsweringTestCaller({
      clinicId: guard.clinic.id,
      patientPhone: parsed.data.patientPhone,
      confirm: parsed.data.confirm,
    });

    return jsonOk({
      ok: true,
      maskedPhone: result.maskedPhone,
      counts: result.counts,
    });
  } catch (err) {
    if (err instanceof TestCallerResetValidationError) {
      return jsonError(err.status, err.code, err.message);
    }
    return jsonError(500, "reset_failed", "Could not reset the test caller.");
  }
}
