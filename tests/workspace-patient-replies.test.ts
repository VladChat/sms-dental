import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveWorkspaceStatus,
  getLatestInboundTimelineItem,
  workspaceStatusForOutcome,
  type WorkspaceTimelineItem,
} from "../app/workspace/_components/workspace-types";
import { detectSmsKeyword } from "../lib/twilio/keywords";

test("workspace status derives needs follow-up when latest message is inbound", () => {
  assert.equal(
    deriveWorkspaceStatus("open", [
      { direction: "outbound" },
      { direction: "inbound" },
    ]),
    "needs_follow_up",
  );
});

test("workspace status derives waiting for patient when latest message is outbound", () => {
  assert.equal(
    deriveWorkspaceStatus("open", [
      { direction: "inbound" },
      { direction: "outbound" },
    ]),
    "waiting_for_patient",
  );
});

test("saved outcome overrides derived workspace status", () => {
  assert.equal(workspaceStatusForOutcome("appointment_booked"), "booked");
  assert.equal(workspaceStatusForOutcome("no_appointment_booked"), "no_appointment_booked");
  assert.equal(workspaceStatusForOutcome("could_not_reach_patient"), "could_not_reach_patient");
  assert.equal(workspaceStatusForOutcome(null), null);
});

test("latest inbound reply helper returns the newest patient message", () => {
  const timeline: WorkspaceTimelineItem[] = [
    {
      id: "first",
      direction: "inbound",
      body: "Earlier patient reply",
      at: "2026-06-10T17:00:00.000Z",
    },
    {
      id: "office",
      direction: "outbound",
      body: "Office follow-up",
      at: "2026-06-10T17:02:00.000Z",
    },
    {
      id: "latest",
      direction: "inbound",
      body: "Hi. I want appoitment",
      at: "2026-06-10T17:55:52.868Z",
    },
  ];

  const latest = getLatestInboundTimelineItem(timeline);

  assert.equal(latest?.id, "latest");
  assert.equal(latest?.body, "Hi. I want appoitment");
});

test("ordinary inbound appointment reply is not treated as STOP/START/HELP", () => {
  assert.equal(detectSmsKeyword("Hi. I want appoitment"), null);
  assert.equal(detectSmsKeyword("STOP"), "stop");
  assert.equal(detectSmsKeyword("start"), "start");
});
