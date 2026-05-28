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
  const { resendApiKey, setupEmailFrom } = getSetupEmailEnv();

  const subject = "Complete your Missed Calls Dental setup";
  const text = buildPlainBody(input.setupUrl);
  const html = buildHtmlBody(input.setupUrl);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: setupEmailFrom,
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

function buildPlainBody(setupUrl: string): string {
  return [
    "Hello,",
    "",
    "Use this secure link to continue your Missed Calls Dental setup:",
    "",
    setupUrl,
    "",
    "You’ll add your office details on the next step.",
    "",
    "If you did not request this setup link, you can ignore this email.",
    "",
    "Missed Calls Dental",
    "support@missedcallsdental.com",
  ].join("\n");
}

function buildHtmlBody(setupUrl: string): string {
  // Inline-styled HTML. Avoid loading external assets. Mirrors the plain
  // body wording exactly so tracking-stripped clients still see the same
  // information.
  const safeUrl = escapeHtml(setupUrl);
  return [
    "<!doctype html>",
    '<html><body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#111827; line-height:1.55;">',
    "<p>Hello,</p>",
    "<p>Use this secure link to continue your Missed Calls Dental setup:</p>",
    `<p><a href="${safeUrl}" style="color:#0d9488; word-break:break-all;">${safeUrl}</a></p>`,
    "<p>You’ll add your office details on the next step.</p>",
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
