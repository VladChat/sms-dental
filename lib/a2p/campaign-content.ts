// Fixed A2P/10DLC campaign content for the Missed Calls Dental product.
//
// Client-safe: NO server imports, so the admin UI, the review-package builder,
// and the submission helper all share one source of truth for exactly what is
// shown to the platform admin and what is submitted to Twilio.
//
// This product sends ONE kind of message: a single missed-call recovery text per
// caller (duplicate-suppressed, opt-out aware). STOP/START/HELP are handled by
// the Twilio Messaging Service's platform-level Advanced Opt-Out, so the campaign
// does NOT manage opt-out/help keywords itself (those campaign fields are only
// required when self-managing, per the Twilio SDK create options).

import type { A2pCampaignContent } from "./types";
export type { A2pCampaignContent };

// A2P use case. Kept conservative for low-volume appointment follow-ups. Override
// in runtime config if your Twilio account/brand qualifies for a different case.
export const A2P_CAMPAIGN_USECASE = "MIXED";

// Build the per-clinic campaign content. The clinic name appears in the sample
// messages exactly as it will in real sends (see lib/twilio/outbound-sms.ts).
export function buildCampaignContent(clinicNameRaw: string | null): A2pCampaignContent {
  const clinicName = (clinicNameRaw ?? "").trim() || "your dental office";

  const description =
    `${clinicName} sends a single appointment follow-up text message to a ` +
    "patient who called the clinic and did not reach the office. The message " +
    "helps the patient request an appointment or a callback. Messages are sent " +
    `through the Missed Calls Dental software platform, but the communication is ` +
    `from ${clinicName}. Volume is low and strictly tied to the patient's own ` +
    "inbound phone call.";

  const messageFlow =
    "Consumers provide consent by placing a phone call to the dental clinic's own " +
    "published business phone number and not reaching staff. The clinic's public " +
    "Privacy Policy and SMS Terms pages disclose that a one-time missed-call " +
    "follow-up text may be sent to the number that called. No marketing list and " +
    "no third-party data is used. Consumers can reply STOP at any time to opt out, " +
    "and HELP for assistance. Messaging is one-to-one and triggered only by the " +
    "consumer's own inbound call to the business.";

  const sampleMessages = [
    `Hi, this is ${clinicName}. We missed your call. Would you like us to help schedule an appointment? Reply STOP to opt out.`,
    `Hi, this is ${clinicName}. Sorry we missed you — reply here to request an appointment or a callback. Reply HELP for help, STOP to opt out.`,
  ];

  const optInStatement =
    "Opt-in: the patient calls the clinic's own business number and is not reached; " +
    "the clinic's Privacy Policy and SMS Terms disclose the one-time follow-up text.";

  const stopHelpStatement =
    "STOP/START/HELP are handled by the Twilio Messaging Service's platform-level " +
    "Advanced Opt-Out (STOP opts out, START opts back in, HELP returns help text).";

  return {
    usecase: A2P_CAMPAIGN_USECASE,
    description,
    messageFlow,
    sampleMessages,
    hasEmbeddedLinks: false,
    hasEmbeddedPhone: false,
    optInStatement,
    stopHelpStatement,
  };
}
