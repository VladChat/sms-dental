import assert from "node:assert/strict";
import test from "node:test";

import {
  rankMessageStatus,
  shouldApplyMessageStatusTransition,
} from "../lib/sms-recovery/message-status";

test("statuses advance in the expected order", () => {
  assert.ok(rankMessageStatus("queued") < rankMessageStatus("sending"));
  assert.ok(rankMessageStatus("sending") < rankMessageStatus("sent"));
  assert.ok(rankMessageStatus("sent") < rankMessageStatus("delivered"));
  assert.ok(rankMessageStatus("sent") < rankMessageStatus("failed"));
});

test("a repeat of the same status is applied (idempotent re-update)", () => {
  assert.equal(shouldApplyMessageStatusTransition("sent", "sent"), true);
  assert.equal(shouldApplyMessageStatusTransition("delivered", "delivered"), true);
});

test("a later callback never regresses a more advanced status", () => {
  assert.equal(shouldApplyMessageStatusTransition("delivered", "sent"), false);
  assert.equal(shouldApplyMessageStatusTransition("sent", "queued"), false);
  assert.equal(shouldApplyMessageStatusTransition("failed", "sending"), false);
});

test("normal progressions are applied", () => {
  assert.equal(shouldApplyMessageStatusTransition("queued", "sent"), true);
  assert.equal(shouldApplyMessageStatusTransition("sent", "delivered"), true);
  assert.equal(shouldApplyMessageStatusTransition("sent", "undelivered"), true);
  assert.equal(shouldApplyMessageStatusTransition("accepted", "queued"), true);
});

test("unknown or missing current status is always overwritten", () => {
  assert.equal(shouldApplyMessageStatusTransition(null, "queued"), true);
  assert.equal(shouldApplyMessageStatusTransition("", "sent"), true);
  assert.equal(shouldApplyMessageStatusTransition("mystery", "delivered"), true);
});

test("an empty next status is never applied", () => {
  assert.equal(shouldApplyMessageStatusTransition("sent", ""), false);
  assert.equal(shouldApplyMessageStatusTransition("sent", null), false);
});

test("status comparison is case/whitespace tolerant", () => {
  assert.equal(shouldApplyMessageStatusTransition("Delivered", " sent "), false);
  assert.equal(shouldApplyMessageStatusTransition(" SENT ", "delivered"), true);
});
