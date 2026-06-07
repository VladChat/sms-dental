import { normalizeProviderStatus } from "../db/sms-readiness";

export type PlatformCustomerProfileKind =
  | "primary"
  | "starter"
  | "secondary"
  | "unknown";

export type PlatformCustomerProfileDiagnostics = {
  sid: string;
  friendlyName: string | null;
  status: string | null;
  normalizedStatus: string;
  policySid: string | null;
  policyFriendlyName: string | null;
  profileKind: PlatformCustomerProfileKind;
  url: string | null;
};

export type PlatformCustomerProfileValidation = {
  ok: boolean;
  code: string | null;
  message: string | null;
  diagnostics: PlatformCustomerProfileDiagnostics;
};

type PlatformCustomerProfileLike = {
  sid: string;
  friendlyName?: string | null;
  friendly_name?: string | null;
  status?: string | null;
  policySid?: string | null;
  policy_sid?: string | null;
  url?: string | null;
};

type TrustHubPolicyLike = {
  sid: string;
  friendlyName?: string | null;
  friendly_name?: string | null;
};

type PlatformCustomerProfileContext = {
  fetch(): Promise<PlatformCustomerProfileLike>;
};

type TrustHubPolicyContext = {
  fetch(): Promise<TrustHubPolicyLike>;
};

export type PlatformCustomerProfileReader = {
  trusthub: {
    v1: {
      customerProfiles(sid: string): PlatformCustomerProfileContext;
      policies(sid: string): TrustHubPolicyContext;
    };
  };
};

export function normalizePlatformCustomerProfileKind(
  policyFriendlyName: string | null | undefined,
): PlatformCustomerProfileKind {
  const normalized = normalizeProviderStatus(policyFriendlyName);
  if (normalized.includes("primary_customer_profile")) return "primary";
  if (normalized.includes("starter_customer_profile")) return "starter";
  if (normalized.includes("secondary_customer_profile")) return "secondary";
  return "unknown";
}

export function isReadyPlatformCustomerProfileStatus(
  status: string | null | undefined,
): boolean {
  const normalized = normalizeProviderStatus(status);
  return [
    "active",
    "approved",
    "in_review",
    "pending_review",
    "registered",
    "twilio_approved",
    "verified",
  ].includes(normalized);
}

export function validateConfiguredPlatformCustomerProfile(input: {
  configuredSid: string;
  profile: PlatformCustomerProfileLike | null;
  policy: TrustHubPolicyLike | null;
}): PlatformCustomerProfileValidation {
  const profile = input.profile;
  const policy = input.policy;
  const diagnostics: PlatformCustomerProfileDiagnostics = {
    sid: input.configuredSid,
    friendlyName: profile?.friendlyName ?? profile?.friendly_name ?? null,
    status: profile?.status ?? null,
    normalizedStatus: normalizeProviderStatus(profile?.status),
    policySid: profile?.policySid ?? profile?.policy_sid ?? policy?.sid ?? null,
    policyFriendlyName: policy?.friendlyName ?? policy?.friendly_name ?? null,
    profileKind: normalizePlatformCustomerProfileKind(
      policy?.friendlyName ?? policy?.friendly_name ?? null,
    ),
    url: profile?.url ?? null,
  };

  if (!profile) {
    return {
      ok: false,
      code: "TWILIO_PLATFORM_CUSTOMER_PROFILE_NOT_FOUND",
      message:
        `Configured Twilio platform customer profile was not found. Current SID: ${input.configuredSid}. ` +
        "Fix runtimeConfig.a2p.trustHub.primaryCustomerProfileSid before submitting A2P.",
      diagnostics,
    };
  }

  if (diagnostics.profileKind === "starter") {
    return {
      ok: false,
      code: "TWILIO_PLATFORM_CUSTOMER_PROFILE_IS_STARTER",
      message:
        `Configured Twilio platform customer profile is not a Primary Customer Profile. Current SID: ${input.configuredSid}. ` +
        "Twilio reports it as a Starter profile. Fix runtimeConfig.a2p.trustHub.primaryCustomerProfileSid before submitting A2P.",
      diagnostics,
    };
  }

  if (diagnostics.profileKind !== "primary") {
    return {
      ok: false,
      code: "TWILIO_PLATFORM_CUSTOMER_PROFILE_NOT_PRIMARY",
      message:
        `Configured Twilio platform customer profile is not a Primary Customer Profile. Current SID: ${input.configuredSid}. ` +
        "Fix runtimeConfig.a2p.trustHub.primaryCustomerProfileSid before submitting A2P.",
      diagnostics,
    };
  }

  if (!isReadyPlatformCustomerProfileStatus(diagnostics.status)) {
    return {
      ok: false,
      code: "TWILIO_PLATFORM_CUSTOMER_PROFILE_NOT_READY",
      message:
        `Configured Twilio platform customer profile is not ready for secondary profile assignment. Current SID: ${input.configuredSid}. ` +
        `Current status: ${diagnostics.status ?? "unknown"}. Fix runtimeConfig.a2p.trustHub.primaryCustomerProfileSid before submitting A2P.`,
      diagnostics,
    };
  }

  return {
    ok: true,
    code: null,
    message: null,
    diagnostics,
  };
}

export async function readConfiguredPlatformCustomerProfile(
  client: PlatformCustomerProfileReader,
  configuredSid: string,
): Promise<PlatformCustomerProfileValidation> {
  let profile: PlatformCustomerProfileLike | null = null;
  let policy: TrustHubPolicyLike | null = null;

  try {
    profile = await client.trusthub.v1.customerProfiles(configuredSid).fetch();
  } catch {
    return validateConfiguredPlatformCustomerProfile({
      configuredSid,
      profile: null,
      policy: null,
    });
  }

  const policySid = profile.policySid ?? profile.policy_sid ?? null;
  if (policySid) {
    try {
      policy = await client.trusthub.v1.policies(policySid).fetch();
    } catch {
      policy = null;
    }
  }

  return validateConfiguredPlatformCustomerProfile({
    configuredSid,
    profile,
    policy,
  });
}
