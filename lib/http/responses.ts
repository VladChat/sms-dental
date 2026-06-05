import { NextResponse } from "next/server";

// Consistent, safe JSON response helpers. Never include stack traces or
// internal error messages in responses sent to external callers.

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
} as const;

export function jsonOk<T extends object>(body: T, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: NO_CACHE_HEADERS,
  });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ?? {}) } },
    { status, headers: NO_CACHE_HEADERS },
  );
}

export function jsonBadRequest(message = "Bad request") {
  return jsonError(400, "bad_request", message);
}

export function jsonUnauthorized(message = "Unauthorized") {
  return jsonError(401, "unauthorized", message);
}

export function jsonForbidden(message = "Forbidden") {
  return jsonError(403, "forbidden", message);
}

export function jsonMethodNotAllowed(message = "Method not allowed") {
  return jsonError(405, "method_not_allowed", message);
}

export function jsonInternalError(message = "Internal error") {
  return jsonError(500, "internal_error", message);
}

// TwiML response for Twilio voice webhooks. Returns valid XML; default body
// is empty `<Response/>` which is a safe no-op for Twilio.
export function twimlResponse(xml: string = "<Response/>") {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>${xml}`,
    {
      status: 200,
      headers: {
        "content-type": "text/xml; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
