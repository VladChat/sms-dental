import { getTwilioClient } from "./client";
import { getTwilioMessagingEnv } from "../env";

// Read-only check: is this exact Twilio phone number (PN SID) a sender in our
// Messaging Service sender pool? Never attaches/detaches senders, never sends
// SMS, never mutates the service.

export type MessagingServiceCoverageResult = {
  messagingServiceSid: string;
  status: "covered" | "missing" | "error";
  errorMessage: string | null;
};

type SenderPoolPhoneNumberResource = {
  fetch(): Promise<{ phoneNumberSid?: string | null }>;
};

type MessagingServiceLike = {
  phoneNumbers(phoneNumberSid: string): SenderPoolPhoneNumberResource;
};

export async function readMessagingServiceSenderCoverage(
  twilioPhoneNumberSid: string,
): Promise<MessagingServiceCoverageResult> {
  const { TWILIO_MESSAGING_SERVICE_SID } = getTwilioMessagingEnv();
  const client = getTwilioClient();
  const service = (client.messaging.v1.services(
    TWILIO_MESSAGING_SERVICE_SID,
  ) as unknown) as MessagingServiceLike;

  try {
    await service.phoneNumbers(twilioPhoneNumberSid).fetch();
    return {
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      status: "covered",
      errorMessage: null,
    };
  } catch (err) {
    // Twilio returns 404 (status 20404) when the number is not in the pool.
    const status = (err as { status?: number })?.status;
    if (status === 404) {
      return {
        messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
        status: "missing",
        errorMessage: null,
      };
    }
    return {
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      status: "error",
      errorMessage: err instanceof Error ? err.message.slice(0, 500) : "unknown",
    };
  }
}
