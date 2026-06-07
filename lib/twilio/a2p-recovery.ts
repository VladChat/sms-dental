export type CustomerProfileRecoveryAction =
  | "create"
  | "assign"
  | "reuse"
  | "rebuild"
  | "manual_review";

export type CustomerProfileRecoveryPlan = {
  action: CustomerProfileRecoveryAction;
  reason: string;
  assignedPlatformCustomerProfileSid: string | null;
};

type PlanInput = {
  customerProfileSid: string | null;
  cpAssignmentsDone: boolean;
  currentPlatformCustomerProfileSid: string;
  assignedObjectSids: string[];
  trustProductSid: string | null;
  brandRegistrationSid: string | null;
  campaignSid: string | null;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function isBundleSid(value: string): boolean {
  return value.startsWith("BU");
}

function hasDownstreamResources(input: PlanInput): boolean {
  return Boolean(
    input.trustProductSid || input.brandRegistrationSid || input.campaignSid,
  );
}

export function planCustomerProfileRecovery(
  input: PlanInput,
): CustomerProfileRecoveryPlan {
  if (!input.customerProfileSid) {
    return {
      action: "create",
      reason: "No existing secondary Customer Profile SID is stored.",
      assignedPlatformCustomerProfileSid: null,
    };
  }

  const assignedPlatformSids = unique(input.assignedObjectSids.filter(isBundleSid));
  const currentAssigned = assignedPlatformSids.includes(
    input.currentPlatformCustomerProfileSid,
  );
  const wrongAssigned = assignedPlatformSids.filter(
    (sid) => sid !== input.currentPlatformCustomerProfileSid,
  );
  const downstreamExists = hasDownstreamResources(input);

  if (!input.cpAssignmentsDone) {
    return {
      action: "assign",
      reason: "Assignments were not completed for the existing secondary Customer Profile.",
      assignedPlatformCustomerProfileSid: currentAssigned
        ? input.currentPlatformCustomerProfileSid
        : assignedPlatformSids[0] ?? null,
    };
  }

  if (currentAssigned && wrongAssigned.length === 0) {
    return {
      action: "reuse",
      reason: "Existing secondary Customer Profile is already assigned to the current platform Primary Customer Profile SID.",
      assignedPlatformCustomerProfileSid: input.currentPlatformCustomerProfileSid,
    };
  }

  if (!currentAssigned && assignedPlatformSids.length === 0) {
    return {
      action: "assign",
      reason: "Existing secondary Customer Profile is missing the current platform Primary Customer Profile assignment.",
      assignedPlatformCustomerProfileSid: null,
    };
  }

  if (downstreamExists) {
    return {
      action: "manual_review",
      reason:
        "Existing Twilio A2P state was built under a different platform Customer Profile SID after downstream resources were created.",
      assignedPlatformCustomerProfileSid: wrongAssigned[0] ?? null,
    };
  }

  return {
    action: "rebuild",
    reason:
      "Existing secondary Customer Profile was assigned to a different platform Customer Profile SID and must be rebuilt before retry.",
    assignedPlatformCustomerProfileSid: wrongAssigned[0] ?? null,
  };
}
