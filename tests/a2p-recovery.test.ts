import test from "node:test";
import assert from "node:assert/strict";

import { planCustomerProfileRecovery } from "../lib/twilio/a2p-recovery";

test("stale cpAssignmentsDone does not skip rebuild when old platform bundle is assigned", () => {
  const result = planCustomerProfileRecovery({
    customerProfileSid: "BUsecondary",
    cpAssignmentsDone: true,
    currentPlatformCustomerProfileSid: "BUprimary-new",
    assignedObjectSids: ["ITbiz", "ITrep", "RDaddress", "BUprimary-old"],
    trustProductSid: null,
    brandRegistrationSid: null,
    campaignSid: null,
  });

  assert.equal(result.action, "rebuild");
  assert.equal(result.assignedPlatformCustomerProfileSid, "BUprimary-old");
});

test("valid already-assigned state remains reusable and idempotent", () => {
  const result = planCustomerProfileRecovery({
    customerProfileSid: "BUsecondary",
    cpAssignmentsDone: true,
    currentPlatformCustomerProfileSid: "BUprimary-new",
    assignedObjectSids: ["ITbiz", "ITrep", "RDaddress", "BUprimary-new"],
    trustProductSid: "BUtrust",
    brandRegistrationSid: "BNbrand",
    campaignSid: "QEcampaign",
  });

  assert.equal(result.action, "reuse");
  assert.equal(result.assignedPlatformCustomerProfileSid, "BUprimary-new");
});

test("existing profile without the current platform bundle re-enters assignment instead of duplicating blindly", () => {
  const result = planCustomerProfileRecovery({
    customerProfileSid: "BUsecondary",
    cpAssignmentsDone: true,
    currentPlatformCustomerProfileSid: "BUprimary-new",
    assignedObjectSids: ["ITbiz", "ITrep", "RDaddress"],
    trustProductSid: null,
    brandRegistrationSid: null,
    campaignSid: null,
  });

  assert.equal(result.action, "assign");
});

test("downstream resources force manual review instead of rebuilding over live state", () => {
  const result = planCustomerProfileRecovery({
    customerProfileSid: "BUsecondary",
    cpAssignmentsDone: true,
    currentPlatformCustomerProfileSid: "BUprimary-new",
    assignedObjectSids: ["ITbiz", "ITrep", "RDaddress", "BUprimary-old"],
    trustProductSid: "BUtrust",
    brandRegistrationSid: null,
    campaignSid: null,
  });

  assert.equal(result.action, "manual_review");
});
