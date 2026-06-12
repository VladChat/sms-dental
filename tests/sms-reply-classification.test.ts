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

test("classifies pain/emergency/urgent wording as safety_concern", () => {
  for (const body of [
    "Pain",
    "tooth pain",
    "severe pain",
    "emergency",
    "urgent",
    "swelling",
    "bleeding",
    "infection",
    "fever",
    "abscess",
    "trauma",
    "knocked out",
    "can't breathe",
    "trouble breathing",
  ]) {
    const classified = classifyInboundReply(body);
    assert.equal(classified.kind, "safety_concern", `should flag: ${body}`);
    assert.equal(classified.hasRequestContent, true);
    // safety_concern does NOT block the guarded follow-up flow.
    assert.equal(replyClassificationBlocksAutoReply(classified.kind), null);
  }
});

test("thanks/ok/negative replies never become safety concerns", () => {
  assert.equal(classifyInboundReply("thanks").kind, "thanks");
  assert.equal(classifyInboundReply("ok").kind, "acknowledgement");
  assert.equal(classifyInboundReply("wrong number").kind, "negative");
});

test("STOP/START/HELP never become safety concerns", () => {
  for (const body of ["STOP", "START", "HELP", "stop.", "Start", "help!"]) {
    const classified = classifyInboundReply(body);
    assert.equal(classified.kind, "unclear_short");
  }
});

test("safety concern carries a safely extracted name when present", () => {
  const classified = classifyInboundReply(
    "Pain. Use Alex Sikorsky as my name. appointment tomorrow",
  );
  assert.equal(classified.kind, "safety_concern");
  assert.equal(classified.patientName, "Alex Sikorsky");
  assert.equal(classified.hasRequestContent, true);
  assert.equal(replyClassificationBlocksAutoReply(classified.kind), null);
});

test("the live manual name reply with filler/request content extracts the name", () => {
  const classified = classifyInboundReply(
    "Ok. maybe, use Alex Sikorsky as my name. appointment need tomorrow",
  );
  assert.equal(classified.kind, "name_provided");
  assert.equal(classified.patientName, "Alex Sikorsky");
});

test("a name can still be extracted on the 3rd or 4th ordinary inbound", () => {
  // Webhook behavior: classifyInboundReply runs on EVERY ordinary inbound and
  // the extracted name is saved only while none is stored yet.
  const first = classifyInboundReply("I need cleaning appointment");
  assert.equal(first.patientName, null);

  const second = classifyInboundReply("appointment need tomorrow morning");
  assert.equal(second.patientName, null);

  const third = classifyInboundReply(
    "Ok. maybe, use alex sikorsky as it's my name appointment need tomorrow",
  );
  assert.equal(third.patientName, "Alex Sikorsky");

  const fourth = classifyInboundReply("my name should be Alex Sikorsky");
  assert.equal(fourth.patientName, "Alex Sikorsky");
});
