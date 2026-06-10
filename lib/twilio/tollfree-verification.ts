import { getTwilioClient } from "./client";
import { textingStatusSyncConfig } from "../../config/texting-status-sync.config";

type TollfreeVerificationLike = {
  sid?: string | null;
  status?: string | null;
  tollfreePhoneNumberSid?: string | null;
  tollfreePhoneNumber?: string | null;
  dateUpdated?: Date | string | null;
  dateCreated?: Date | string | null;
};

type TollfreeVerificationList = {
  list(input: {
    tollfreePhoneNumberSid: string;
    limit: number;
    pageSize: number;
  }): Promise<TollfreeVerificationLike[]>;
};

export type TollfreeVerificationReadResult =
  | {
      found: true;
      verificationSid: string | null;
      providerStatus: string;
      phoneNumber: string | null;
    }
  | {
      found: false;
      verificationSid: null;
      providerStatus: null;
      phoneNumber: null;
    };

// Read-only Twilio Toll-Free Verification lookup. This never creates, updates,
// submits, or deletes provider resources.
export async function readTollfreeVerificationForPhoneNumberSid(
  tollfreePhoneNumberSid: string,
): Promise<TollfreeVerificationReadResult> {
  const client = getTwilioClient();
  const verifications = (client.messaging.v1 as unknown as {
    tollfreeVerifications: TollfreeVerificationList;
  }).tollfreeVerifications;
  const items = await verifications.list({
    tollfreePhoneNumberSid,
    limit: textingStatusSyncConfig.twilio.tollfreeVerificationListLimit,
    pageSize: textingStatusSyncConfig.twilio.tollfreeVerificationPageSize,
  });
  const verification = chooseLatestVerification(items);
  if (!verification) {
    return {
      found: false,
      verificationSid: null,
      providerStatus: null,
      phoneNumber: null,
    };
  }
  return {
    found: true,
    verificationSid: verification.sid ?? null,
    providerStatus: verification.status ?? "UNKNOWN",
    phoneNumber: verification.tollfreePhoneNumber ?? null,
  };
}

function chooseLatestVerification(
  items: TollfreeVerificationLike[],
): TollfreeVerificationLike | null {
  if (items.length === 0) return null;
  return [...items].sort((a, b) => timestampOf(b) - timestampOf(a))[0] ?? null;
}

function timestampOf(item: TollfreeVerificationLike): number {
  const raw = item.dateUpdated ?? item.dateCreated ?? null;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "string") {
    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
