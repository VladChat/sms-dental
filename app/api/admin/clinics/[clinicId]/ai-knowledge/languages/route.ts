import type { NextRequest, NextResponse } from "next/server";
import { runAdminAiKnowledgeSave } from "../../../../../../../lib/ai-knowledge/admin-route";
import { handleLanguagesSave } from "../../../../../../../lib/ai-knowledge/section-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/clinics/[clinicId]/ai-knowledge/languages
export function POST(req: NextRequest, ctx: { params: Promise<{ clinicId: string }> }): Promise<NextResponse> {
  return runAdminAiKnowledgeSave(req, ctx, handleLanguagesSave);
}
