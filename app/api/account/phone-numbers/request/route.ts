import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/phone-numbers/request — RETIRED.
//
// The owner number-request workflow has been replaced by direct self-service
// purchase at POST /api/account/phone-numbers/purchase. This endpoint no longer
// creates clinic_number_requests rows. Existing rows remain intact (admin views
// them under "Legacy number requests"); old clients fail safely with 410.
export async function POST(): Promise<NextResponse> {
  return jsonError(
    410,
    "number_request_flow_retired",
    "Number requests are no longer used. Choose an available number to purchase and assign it directly.",
  );
}
