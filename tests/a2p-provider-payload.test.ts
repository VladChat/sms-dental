import test from "node:test";
import assert from "node:assert/strict";

import { buildBrandRegistrationPayload } from "../lib/a2p/provider-payload";

test("mock brand payload includes mock true", () => {
  const payload = buildBrandRegistrationPayload({
    customerProfileSid: "BUcustomer",
    trustProductSid: "BUtrust",
    mock: true,
  });

  assert.equal(payload.mock, true);
});

test("live brand payload omits mock flag", () => {
  const payload = buildBrandRegistrationPayload({
    customerProfileSid: "BUcustomer",
    trustProductSid: "BUtrust",
  });

  assert.equal("mock" in payload, false);
});
