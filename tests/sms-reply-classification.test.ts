import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyInboundReply,
  replyClassificationBlocksAutoReply,
} from "../lib/sms-recovery/reply-classification";

test("classifies thanks replies with no automated follow-up", () => {
  for (const body of ["thanks", "Thank you", "thx", "thank you so much", "appreciate it"]) {
    const classified = classifyInboundReply(body);
    assert.equal(classified.kind, "thanks");
    assert.equal(replyClassificationBlocksAutoReply(classified.kind), "reply_thanks");
  }
});

test("classifies acknowledgements with no automated follow-up", () => {
  for (const body of ["ok", "okay", "k", "got it", "sounds good", "great", "perfect", "yes", "sure"]) {
    const classified = classifyInboundReply(body);
    assert.equal(classified.kind, "acknowledgement");
    assert.equal(replyClassificationBlocksAutoReply(classified.kind), "reply_acknowledgement");
  }
});

test("classifies negative replies without treating them as STOP", () => {
  for (const body of ["no", "not now", "never mind", "cancel", "not interested", "wrong number"]) {
    const classified = classifyInboundReply(body);
    assert.equal(classified.kind, "negative");
    assert.equal(replyClassificationBlocksAutoReply(classified.kind), "reply_negative");
  }
});

test("classifies short unclear replies with no automated follow-up", () => {
  for (const body of ["?", "hmm", "maybe", "later", "idk"]) {
    const classified = classifyInboundReply(body);
    assert.equal(classified.kind, "unclear_short");
    assert.equal(replyClassificationBlocksAutoReply(classified.kind), "reply_unclear_short");
  }
});

test("extracts a safe name from a first reply with request content", () => {
  const classified = classifyInboundReply("My name is Jon Svillow. I need an appointment");
  assert.equal(classified.kind, "name_provided");
  assert.equal(classified.patientName, "Jon Svillow");
  assert.equal(classified.hasRequestContent, true);
  assert.equal(replyClassificationBlocksAutoReply(classified.kind), null);
});

test("keeps request content informative when no safe name is present", () => {
  const classified = classifyInboundReply("I need an appointment tomorrow");
  assert.equal(classified.kind, "informative");
  assert.equal(classified.patientName, null);
  assert.equal(classified.hasRequestContent, true);
});

test("classifies the live cleaning appointment reply as informative", () => {
  const classified = classifyInboundReply("I need cleaning appointment");
  assert.equal(classified.kind, "informative");
  assert.equal(classified.patientName, null);
  assert.equal(classified.hasRequestContent, true);
  assert.equal(replyClassificationBlocksAutoReply(classified.kind), null);
});

test("classifies the live name reply and extracts Vlad", () => {
  const classified = classifyInboundReply("I'm Vlad");
  assert.equal(classified.kind, "name_provided");
  assert.equal(classified.patientName, "Vlad");
  assert.equal(classified.hasRequestContent, false);
  assert.equal(replyClassificationBlocksAutoReply(classified.kind), null);
});

test("thanks and ok are saved but block automated follow-up slots", () => {
  for (const [body, reason] of [
    ["thanks", "reply_thanks"],
    ["ok", "reply_acknowledgement"],
  ] as const) {
    const classified = classifyInboundReply(body);
    assert.equal(replyClassificationBlocksAutoReply(classified.kind), reason);
  }
});

test("compliance keywords are outside the normal follow-up flow", () => {
  for (const body of ["STOP", "START", "HELP"]) {
    const classified = classifyInboundReply(body);
    assert.equal(classified.kind, "unclear_short");
    assert.equal(classified.patientName, null);
  }
});
