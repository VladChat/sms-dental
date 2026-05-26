import { getSetupEmailEnv } from "../env";

// Setup link email delivery via Resend.
//
// We use `fetch` directly against the Resend REST API to avoid adding a new
// SDK dependency. Errors are surfaced — the API route is responsible for
// updating `setup_requests.email_status` on failure and keeping the request
// in `requested` status so the caller can be told plainly.
//
// Never log raw setup tokens or full setup URLs at info level. The setup URL
// is included only inside the email body sent over TLS to the requester.

export type SetupLinkEmailInput = {
  to: string;
  ownerName: string;
  setupUrl: string;
};

export class SetupEmailDeliveryError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "SetupEmailDeliveryError";
    this.status = status;
    this.body = body;
  }
}

export async function sendSetupLinkEmail(
  input: SetupLinkEmailInput,
): Promise<{ id: string | null }> {
  const { RESEND_API_KEY, SETUP_EMAIL_FROM } = getSetupEmailEnv();

  const subject = "Complete your Missed Calls Dental setup";
  const text = buildPlainBody(input.ownerName, input.setupUrl);
  const html = buildHtmlBody(input.ownerName, input.setupUrl);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: SETUP_EMAIL_FROM,
      to: [input.to],
      subject,
      text,
      html,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new SetupEmailDeliveryError(
      "Resend rejected the setup email",
      response.status,
      responseText.slice(0, 500),
    );
  }

  try {
    const parsed = JSON.parse(responseText) as { id?: string };
    return { id: typeof parsed.id === "string" ? parsed.id : null };
  } catch {
    return { id: null };
  }
}

function buildPlainBody(ownerName: string, setupUrl: string): string {
  return [
    `Hi ${ownerName},`,
    "",
    "Use the secure link below to complete your Missed Calls Dental setup:",
    "",
    setupUrl,
    "",
    "During setup, you will choose an office texting number for missed-call follow-up texts. This is an additional number and will not replace your existing office phone number.",
    "",
    "If you did not request this setup link, you can ignore this email.",
    "",
    "Missed Calls Dental",
    "support@missedcallsdental.com",
  ].join("\n");
}

function buildHtmlBody(ownerName: string, setupUrl: string): string {
  // Inline-styled HTML. Avoid loading external assets. Mirrors the plain
  // body wording exactly so tracking-stripped clients still see the same
  // information.
  const safeName = escapeHtml(ownerName);
  const safeUrl = escapeHtml(setupUrl);
  return [
    "<!doctype html>",
    '<html><body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#111827; line-height:1.55;">',
    `<p>Hi ${safeName},</p>`,
    "<p>Use the secure link below to complete your Missed Calls Dental setup:</p>",
    `<p><a href="${safeUrl}" style="color:#0d9488; word-break:break-all;">${safeUrl}</a></p>`,
    "<p>During setup, you will choose an office texting number for missed-call follow-up texts. This is an additional number and will not replace your existing office phone number.</p>",
    "<p>If you did not request this setup link, you can ignore this email.</p>",
    '<p style="color:#6b7280; font-size:14px;">Missed Calls Dental<br>support@missedcallsdental.com</p>',
    "</body></html>",
  ].join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
