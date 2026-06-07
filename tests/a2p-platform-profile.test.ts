import test from "node:test";
import assert from "node:assert/strict";

import {
  isReadyPlatformCustomerProfileStatus,
  validateConfiguredPlatformCustomerProfile,
} from "../lib/twilio/platform-customer-profile";

test("starter platform customer profile is rejected by preflight", () => {
  const result = validateConfiguredPlatformCustomerProfile({
    configuredSid: "BUaeab21ee3b774f0293e17522e6a1337c",
    profile: {
      sid: "BUaeab21ee3b774f0293e17522e6a1337c",
      friendly_name: "AllyExporter LLC",
      status: "twilio-approved",
      policy_sid: "RN13dc4be8861a10924a79c35eaa4d812c",
    },
    policy: {
      sid: "RN13dc4be8861a10924a79c35eaa4d812c",
      friendly_name: "Starter Customer Profile for direct customers",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "TWILIO_PLATFORM_CUSTOMER_PROFILE_IS_STARTER");
  assert.equal(result.diagnostics.profileKind, "starter");
});

test("primary active platform customer profile passes preflight", () => {
  const result = validateConfiguredPlatformCustomerProfile({
    configuredSid: "BU668e1080d4cbf61beec1a8dac79c3353",
    profile: {
      sid: "BU668e1080d4cbf61beec1a8dac79c3353",
      friendly_name: "missedcallsdental.com",
      status: "active",
      policy_sid: "RN6433641899984f951173ef1738c3bdd0",
    },
    policy: {
      sid: "RN6433641899984f951173ef1738c3bdd0",
      friendly_name: "Primary Customer Profile of type Business",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, null);
  assert.equal(result.diagnostics.profileKind, "primary");
});

test("non-ready primary platform customer profile is rejected", () => {
  const result = validateConfiguredPlatformCustomerProfile({
    configuredSid: "BU668e1080d4cbf61beec1a8dac79c3353",
    profile: {
      sid: "BU668e1080d4cbf61beec1a8dac79c3353",
      friendly_name: "missedcallsdental.com",
      status: "draft",
      policy_sid: "RN6433641899984f951173ef1738c3bdd0",
    },
    policy: {
      sid: "RN6433641899984f951173ef1738c3bdd0",
      friendly_name: "Primary Customer Profile of type Business",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "TWILIO_PLATFORM_CUSTOMER_PROFILE_NOT_READY");
});

test("status helper allows approved and review-ready profile states", () => {
  assert.equal(isReadyPlatformCustomerProfileStatus("twilio-approved"), true);
  assert.equal(isReadyPlatformCustomerProfileStatus("in-review"), true);
  assert.equal(isReadyPlatformCustomerProfileStatus("active"), true);
  assert.equal(isReadyPlatformCustomerProfileStatus("draft"), false);
});
