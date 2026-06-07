import test from "node:test";
import assert from "node:assert/strict";

import {
  bindTrustHubListMethod,
  requireTrustHubEvaluationStatus,
} from "../lib/twilio/trusthub-helpers";

test("bindTrustHubListMethod preserves Twilio-style list context", async () => {
  const container = {
    _version: "v1",
    async list(this: { _version: string }, params: { limit: number }) {
      return [`${this._version}:${params.limit}`];
    },
  };

  const list = bindTrustHubListMethod(container);
  assert.ok(list);
  await assert.doesNotReject(async () => {
    const result = await list?.({ limit: 50 });
    assert.deepEqual(result, ["v1:50"]);
  });
});

test("bindTrustHubListMethod returns null when list is unavailable", () => {
  assert.equal(bindTrustHubListMethod({}), null);
});

test("requireTrustHubEvaluationStatus accepts compliant status", () => {
  assert.equal(
    requireTrustHubEvaluationStatus({ sid: "EL123", status: "compliant" }, "Customer Profile"),
    "compliant",
  );
});

test("requireTrustHubEvaluationStatus rejects missing evaluation object", () => {
  assert.throws(
    () => requireTrustHubEvaluationStatus(undefined, "Customer Profile"),
    /returned no result/i,
  );
});

test("requireTrustHubEvaluationStatus rejects missing evaluation status", () => {
  assert.throws(
    () => requireTrustHubEvaluationStatus({ sid: "EL123", status: " " }, "Trust Product"),
    /returned no status/i,
  );
});
