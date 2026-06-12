import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAutoReplyDecision,
  evaluateThanksCourtesyDecision,
  THANKS_COURTESY_REPLY_BODY,
  type AutoReplyDecisionInput,
  type ThanksCourtesyDecisionInput,
} from "../lib/sms-recovery/auto-reply-evaluation";
import {
  DEFAULT_FOLLOW_UP_TEMPLATES,
  renderConversationTemplate,
} from "../lib/sms-recovery/conversation-templates";
import { classifyInboundReply } from "../lib/sms-recovery/reply-classification";

// A baseline where an auto-reply WOULD send (first follow-up).
function base(overrides: Partial<AutoReplyDecisionInput> = {}): AutoReplyDecisionInput {
  return {
    keyword: null,
    isDuplicateInbound: false,
    replyClassification: "informative",
    modeAllowsSend: true,
    gateOk: true,
    optedOut: false,
    hasPriorRecoveryOutbound: true,
    maxAutoReplies: 10,
    currentAutoReplyCount: 0,
    patientNameKnown: false,
    enabledSequences: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    ...overrides,
  };
}

function thanksBase(
  overrides: Partial<ThanksCourtesyDecisionInput> = {},
): ThanksCourtesyDecisionInput {
  return {
    keyword: null,
    isDuplicateInbound: false,
    replyClassification: "thanks",
    modeAllowsSend: true,
    gateOk: true,
    optedOut: false,
    hasPriorRecoveryOutbound: true,
    maxAutoReplies: 10,
    thanksCourtesyAlreadySent: false,
    ...overrides,
  };
}

test("ordinary replies send follow-up 1 through 10 when enabled", () => {
  assert.deepEqual(evaluateAutoReplyDecision(base({ currentAutoReplyCount: 0 })), { send: true, sequence: 1 });
  assert.deepEqual(evaluateAutoReplyDecision(base({ currentAutoReplyCount: 1 })), { send: true, sequence: 2 });
  assert.deepEqual(evaluateAutoReplyDecision(base({ currentAutoReplyCount: 2 })), { send: true, sequence: 3 });
  assert.deepEqual(evaluateAutoReplyDecision(base({ currentAutoReplyCount: 3 })), { send: true, sequence: 4 });
  assert.deepEqual(evaluateAutoReplyDecision(base({ currentAutoReplyCount: 9 })), { send: true, sequence: 10 });
});

test("eleventh reply sends nothing (max reached)", () => {
  const d = evaluateAutoReplyDecision(base({ currentAutoReplyCount: 10 }));
  assert.equal(d.send, false);
});

test("max_auto_replies = 0 disables all auto-replies", () => {
  const d = evaluateAutoReplyDecision(base({ maxAutoReplies: 0, enabledSequences: [] }));
  assert.deepEqual(d, { send: false, reason: "auto_replies_disabled" });
});

test("STOP/HELP/START never auto-reply", () => {
  for (const keyword of ["stop", "help", "start"] as const) {
    const d = evaluateAutoReplyDecision(base({ keyword }));
    assert.deepEqual(d, { send: false, reason: `keyword_${keyword}` });
  }
});

test("duplicate inbound never auto-replies", () => {
  assert.deepEqual(evaluateAutoReplyDecision(base({ isDuplicateInbound: true })), {
    send: false,
    reason: "duplicate_inbound",
  });
});

test("thanks, acknowledgements, negative replies, and unclear short replies do not consume a follow-up", () => {
  assert.deepEqual(evaluateAutoReplyDecision(base({ replyClassification: "thanks" })), {
    send: false,
    reason: "reply_thanks",
  });
  assert.deepEqual(evaluateAutoReplyDecision(base({ replyClassification: "acknowledgement" })), {
    send: false,
    reason: "reply_acknowledgement",
  });
  assert.deepEqual(evaluateAutoReplyDecision(base({ replyClassification: "negative" })), {
    send: false,
    reason: "reply_negative",
  });
  assert.deepEqual(evaluateAutoReplyDecision(base({ replyClassification: "unclear_short" })), {
    send: false,
    reason: "reply_unclear_short",
  });
});

test("thanks courtesy sends once through its own deterministic decision", () => {
  assert.deepEqual(evaluateThanksCourtesyDecision(thanksBase()), {
    send: true,
    body: THANKS_COURTESY_REPLY_BODY,
  });
  assert.deepEqual(evaluateThanksCourtesyDecision(thanksBase({ thanksCourtesyAlreadySent: true })), {
    send: false,
    reason: "thanks_courtesy_already_sent",
  });
});

test("thanks courtesy requires normal send gates but no enabled numbered slot", () => {
  assert.deepEqual(evaluateThanksCourtesyDecision(thanksBase({ maxAutoReplies: 0 })), {
    send: false,
    reason: "auto_replies_disabled",
  });
  assert.deepEqual(evaluateThanksCourtesyDecision(thanksBase({ hasPriorRecoveryOutbound: false })), {
    send: false,
    reason: "no_prior_recovery",
  });
  assert.deepEqual(evaluateThanksCourtesyDecision(thanksBase({ optedOut: true })), {
    send: false,
    reason: "opted_out",
  });
  assert.deepEqual(evaluateThanksCourtesyDecision(thanksBase({ gateOk: false })), {
    send: false,
    reason: "send_gate_blocked",
  });
});

test("thanks courtesy never sends for keywords, duplicate inbounds, or non-thanks replies", () => {
  assert.deepEqual(evaluateThanksCourtesyDecision(thanksBase({ keyword: "stop" })), {
    send: false,
    reason: "keyword_stop",
  });
  assert.deepEqual(evaluateThanksCourtesyDecision(thanksBase({ isDuplicateInbound: true })), {
    send: false,
    reason: "duplicate_inbound",
  });
  assert.deepEqual(evaluateThanksCourtesyDecision(thanksBase({ replyClassification: "acknowledgement" })), {
    send: false,
    reason: "not_thanks",
  });
});

test("known patient name skips the first name-question follow-up", () => {
  assert.deepEqual(
    evaluateAutoReplyDecision(base({ currentAutoReplyCount: 0, patientNameKnown: true })),
    { send: true, sequence: 2 },
  );
});

test("known patient name does not send if the next usable slot is not enabled", () => {
  assert.deepEqual(
    evaluateAutoReplyDecision(base({
      currentAutoReplyCount: 0,
      patientNameKnown: true,
      enabledSequences: [1],
    })),
    { send: false, reason: "template_disabled" },
  );
});

test("opted-out patient gets no auto-reply", () => {
  assert.deepEqual(evaluateAutoReplyDecision(base({ optedOut: true })), {
    send: false,
    reason: "opted_out",
  });
});

test("readiness/gate failure blocks auto-reply", () => {
  assert.deepEqual(evaluateAutoReplyDecision(base({ gateOk: false })), {
    send: false,
    reason: "send_gate_blocked",
  });
});

test("disabled mode blocks auto-reply", () => {
  assert.deepEqual(evaluateAutoReplyDecision(base({ modeAllowsSend: false })), {
    send: false,
    reason: "mode_disabled",
  });
});

test("no prior recovery outbound blocks auto-reply", () => {
  assert.deepEqual(evaluateAutoReplyDecision(base({ hasPriorRecoveryOutbound: false })), {
    send: false,
    reason: "no_prior_recovery",
  });
});

test("a disabled template slot is skipped (not sent)", () => {
  // Slot 2 disabled: after first auto-reply, the next (slot 2) is not sent.
  const d = evaluateAutoReplyDecision(base({ currentAutoReplyCount: 1, enabledSequences: [1, 3] }));
  assert.deepEqual(d, { send: false, reason: "template_disabled" });
});

test("max below the next slot caps replies", () => {
  // max=1: after one reply, no second auto-reply even if templates enabled.
  const d = evaluateAutoReplyDecision(base({ maxAutoReplies: 1, currentAutoReplyCount: 1, enabledSequences: [1] }));
  assert.deepEqual(d, { send: false, reason: "max_auto_replies_reached" });
});

test("new missed-call recovery cycle reset restores follow-up eligibility", () => {
  assert.deepEqual(
    evaluateAutoReplyDecision(base({ currentAutoReplyCount: 10 })),
    { send: false, reason: "max_auto_replies_reached" },
  );

  assert.deepEqual(
    evaluateAutoReplyDecision(base({ currentAutoReplyCount: 0 })),
    { send: true, sequence: 1 },
  );
});

test("live manual +12245329236 cleaning/name sequence sends two expected follow-ups, then stops on thanks", () => {
  const recordedRecoverySms = {
    toNumber: "+12245329236",
    messageKind: "missed_call_recovery",
    smsAutoReplyCountAfterReset: 0,
  };
  assert.deepEqual(recordedRecoverySms, {
    toNumber: "+12245329236",
    messageKind: "missed_call_recovery",
    smsAutoReplyCountAfterReset: 0,
  });

  const firstInbound = classifyInboundReply("I need cleaning appointment");
  assert.equal(firstInbound.kind, "informative");
  assert.equal(firstInbound.patientName, null);
  assert.deepEqual(
    evaluateAutoReplyDecision(base({
      replyClassification: firstInbound.kind,
      currentAutoReplyCount: 0,
      patientNameKnown: false,
    })),
    { send: true, sequence: 1 },
  );
  assert.equal(
    renderConversationTemplate(DEFAULT_FOLLOW_UP_TEMPLATES[1], {
      clinicName: "Fairstone Dental Smile",
      patientName: null,
    }),
    "Thanks for the info. What name should we use when our office follows up?",
  );

  const secondInbound = classifyInboundReply("I'm Vlad");
  assert.equal(secondInbound.kind, "name_provided");
  assert.equal(secondInbound.patientName, "Vlad");
  assert.deepEqual(
    evaluateAutoReplyDecision(base({
      replyClassification: secondInbound.kind,
      currentAutoReplyCount: 1,
      patientNameKnown: true,
    })),
    { send: true, sequence: 2 },
  );
  assert.equal(
    renderConversationTemplate(DEFAULT_FOLLOW_UP_TEMPLATES[2], {
      clinicName: "Fairstone Dental Smile",
      patientName: secondInbound.patientName,
    }),
    "Thanks, Vlad. I'll pass this to our team so they can follow up.",
  );

  const thanksInbound = classifyInboundReply("thanks");
  assert.equal(thanksInbound.kind, "thanks");
  assert.deepEqual(
    evaluateAutoReplyDecision(base({
      replyClassification: thanksInbound.kind,
      currentAutoReplyCount: 2,
      patientNameKnown: true,
    })),
    { send: false, reason: "reply_thanks" },
  );
  assert.deepEqual(
    evaluateThanksCourtesyDecision(thanksBase({
      replyClassification: thanksInbound.kind,
      maxAutoReplies: 3,
    })),
    { send: true, body: THANKS_COURTESY_REPLY_BODY },
  );

  const okInbound = classifyInboundReply("ok");
  assert.equal(okInbound.kind, "acknowledgement");
  assert.deepEqual(
    evaluateAutoReplyDecision(base({
      replyClassification: okInbound.kind,
      currentAutoReplyCount: 2,
      patientNameKnown: true,
    })),
    { send: false, reason: "reply_acknowledgement" },
  );
});
