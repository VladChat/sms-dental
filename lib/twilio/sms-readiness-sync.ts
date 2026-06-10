import { getTwilioClient } from "./client";
import { getTwilioMessagingEnv } from "../env";
import {
  isSafeBrandStatus,
  isSafeCampaignStatus,
  listActiveSmsNumbersForClinic,
  normalizeProviderStatus,
  upsertSmsReadinessSync,
  type A2pStatus,
  type ClinicReadinessSyncInput,
  type MessagingServiceStatus,
  type NumberCoverageStatus,
  type SmsReadinessSummary,
} from "../db/sms-readiness";
import { logger } from "../logging/logger";

// Read-only Twilio SMS readiness sync. This module only performs Twilio reads
// and writes the local readiness tables. It never sends SMS, never submits A2P,
// and never attaches/detaches Messaging Service senders.

type MessagingServiceResource = {
  fetch(): Promise<{ sid: string; friendlyName?: string | null }>;
  phoneNumbers: {
    // The sender-pool resource's `sid` IS the IncomingPhoneNumber PN SID.
    // (Verified against the live API 2026-06-10: there is no `phoneNumberSid`
    // property on list items — matching on it left the sender set empty and
    // marked every covered number "missing".) Keep `phoneNumberSid` as a
    // defensive fallback in case a future SDK adds it.
    list(input: {
      limit: number;
    }): Promise<Array<{ sid?: string | null; phoneNumberSid?: string | null }>>;
  };
  usAppToPerson?: {
    list(input: { limit: number }): Promise<TwilioCampaignLike[]>;
  };
};

type TwilioMessagingV1 = {
  services(sid: string): MessagingServiceResource;
  brandRegistrations?: {
    list(input: { limit: number }): Promise<TwilioBrandLike[]>;
  };
};

type TwilioCampaignLike = {
  sid?: string | null;
  brandRegistrationSid?: string | null;
  campaignStatus?: string | null;
  status?: string | null;
  usAppToPersonUsecase?: string | null;
  usecase?: string | null;
};

type TwilioBrandLike = {
  sid?: string | null;
  status?: string | null;
  brandType?: string | null;
};

export async function syncClinicSmsReadinessFromTwilio(
  clinicId: string,
): Promise<SmsReadinessSummary> {
  const { TWILIO_MESSAGING_SERVICE_SID } = getTwilioMessagingEnv();
  const syncedAt = new Date();
  const activeNumbers = await listActiveSmsNumbersForClinic(clinicId);

  const client = getTwilioClient();
  const messaging = client.messaging.v1 as unknown as TwilioMessagingV1;
  const service = messaging.services(TWILIO_MESSAGING_SERVICE_SID);

  let serviceStatus: MessagingServiceStatus = "unknown";
  let serviceError: string | null = null;
  let senderSidSet = new Set<string>();

  try {
    await service.fetch();
    serviceStatus = "verified";
    const senders = await service.phoneNumbers.list({ limit: 1000 });
    senderSidSet = new Set(
      senders
        .flatMap((sender) => [sender.sid ?? null, sender.phoneNumberSid ?? null])
        .filter((sid): sid is string => typeof sid === "string" && sid.length > 0),
    );
  } catch (err) {
    serviceStatus = "error";
    serviceError = safeMessage(err);
  }

  let campaigns: TwilioCampaignLike[] = [];
  let campaignError: string | null = null;
  try {
    campaigns = service.usAppToPerson
      ? await service.usAppToPerson.list({ limit: 20 })
      : [];
  } catch (err) {
    campaignError = safeMessage(err);
  }

  let brands: TwilioBrandLike[] = [];
  let brandError: string | null = null;
  try {
    brands = messaging.brandRegistrations
      ? await messaging.brandRegistrations.list({ limit: 20 })
      : [];
  } catch (err) {
    brandError = safeMessage(err);
  }

  const campaign = chooseCampaign(campaigns);
  const campaignSid = campaign?.sid ?? null;
  const campaignStatus = normalizeProviderStatus(
    campaign?.campaignStatus ?? campaign?.status ?? null,
  );
  const campaignUsecase = campaign?.usAppToPersonUsecase ?? campaign?.usecase ?? null;
  const brandSid = campaign?.brandRegistrationSid ?? brands[0]?.sid ?? null;
  const brand = brandSid ? brands.find((b) => b.sid === brandSid) ?? null : brands[0] ?? null;
  const brandStatus = normalizeProviderStatus(brand?.status ?? null);

  const brandReady = isSafeBrandStatus(brandStatus);
  const campaignReady = isSafeCampaignStatus(campaignStatus);
  const a2pStatus: A2pStatus =
    brandReady && campaignReady
      ? "verified"
      : brandStatus === "rejected" || campaignStatus === "rejected"
        ? "rejected"
        : brandError || campaignError
          ? "failed"
          : "blocked";

  const globalBlockingReason = firstReason([
    serviceStatus !== "verified" ? "messaging_service_not_verified" : null,
    brandError ? "a2p_brand_lookup_failed" : null,
    campaignError ? "a2p_campaign_lookup_failed" : null,
    !brandReady ? "a2p_brand_not_verified" : null,
    !campaignReady ? "a2p_campaign_not_verified" : null,
  ]);
  const globalProductionSafe = !globalBlockingReason;

  const numberInputs = activeNumbers.map((n) => {
    const sid = n.twilio_phone_number_sid;
    const senderStatus: NumberCoverageStatus =
      serviceStatus === "error"
        ? "error"
        : sid && senderSidSet.has(sid)
          ? "covered"
          : "missing";
    const campaignCoverage: NumberCoverageStatus =
      senderStatus === "covered" && campaignReady ? "covered" : "missing";
    const blockingReason = firstReason([
      !sid ? "number_missing_twilio_sid" : null,
      senderStatus !== "covered" ? "number_not_in_messaging_service" : null,
      campaignCoverage !== "covered" ? "number_not_campaign_covered" : null,
    ]);
    return {
      clinicPhoneNumberId: n.id,
      phoneNumber: n.phone_number,
      twilioPhoneNumberSid: sid,
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      messagingServiceSenderStatus: senderStatus,
      a2pCampaignCoverageStatus: campaignCoverage,
      productionSafe: blockingReason === null,
      launchBlockingReason: blockingReason,
      statusSource: "read_only_sync" as const,
      lastSyncedAt: syncedAt,
      lastSyncErrorCode: senderStatus === "error" ? "messaging_service_lookup_failed" : null,
      lastSyncErrorMessage: senderStatus === "error" ? serviceError : null,
    };
  });

  const input: ClinicReadinessSyncInput = {
    clinicId,
    messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
    messagingServiceStatus: serviceStatus,
    brandSid,
    brandStatus,
    campaignSid,
    campaignStatus,
    campaignUsecase,
    a2pStatus,
    productionSafe: globalProductionSafe,
    launchBlockingReason: globalBlockingReason,
    statusSource: "read_only_sync",
    lastSyncedAt: syncedAt,
    lastSyncErrorCode:
      serviceStatus === "error"
        ? "messaging_service_lookup_failed"
        : brandError
          ? "a2p_brand_lookup_failed"
          : campaignError
            ? "a2p_campaign_lookup_failed"
            : null,
    lastSyncErrorMessage: serviceError ?? brandError ?? campaignError,
    numbers: numberInputs,
  };

  const summary = await upsertSmsReadinessSync(input);
  logger.info("twilio.sms_readiness.synced", {
    clinicId,
    serviceStatus,
    brandStatus,
    campaignStatus,
    launchReady: summary.launchReady,
  });
  return summary;
}

function chooseCampaign(campaigns: TwilioCampaignLike[]): TwilioCampaignLike | null {
  return (
    campaigns.find((c) => isSafeCampaignStatus(c.campaignStatus ?? c.status ?? null)) ??
    campaigns[0] ??
    null
  );
}

function firstReason(reasons: Array<string | null>): string | null {
  return reasons.find((reason): reason is string => Boolean(reason)) ?? null;
}

function safeMessage(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 500) : "unknown";
}
