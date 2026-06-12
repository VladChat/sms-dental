import assert from "node:assert/strict";
import test from "node:test";

import { extractPatientName } from "../lib/sms-recovery/patient-name";

test("extracts simple names", () => {
  assert.equal(extractPatientName("John"), "John");
  assert.equal(extractPatientName("John Smith"), "John Smith");
  assert.equal(extractPatientName("My name is John"), "John");
  assert.equal(extractPatientName("My name is John Smith"), "John Smith");
  assert.equal(extractPatientName("This is John"), "John");
  assert.equal(extractPatientName("I'm John"), "John");
  assert.equal(extractPatientName("I'm Vlad"), "Vlad");
  assert.equal(extractPatientName("I am John"), "John");
  assert.equal(
    extractPatientName("My name is Jon Svillow. I need an appointment"),
    "Jon Svillow",
  );
  assert.equal(
    extractPatientName("My name is Jon Svillow and I need an appointment"),
    "Jon Svillow",
  );
});

test("title-cases and preserves apostrophes/hyphens", () => {
  assert.equal(extractPatientName("mary-jane"), "Mary-Jane");
  assert.equal(extractPatientName("o'brien"), "O'Brien");
  assert.equal(extractPatientName("my name is sarah"), "Sarah");
});

test("does not extract from ambiguous / appointment requests", () => {
  assert.equal(extractPatientName("I need an appointment tomorrow"), null);
  assert.equal(extractPatientName("Can I book a cleaning next week?"), null);
  assert.equal(extractPatientName("I have tooth pain"), null);
  assert.equal(extractPatientName("what is the price of a cleaning"), null);
  assert.equal(extractPatientName("thanks"), null);
  assert.equal(extractPatientName("ok"), null);
  assert.equal(extractPatientName("thank you so much"), null);
});

test("does not extract from STOP/HELP/START", () => {
  assert.equal(extractPatientName("STOP"), null);
  assert.equal(extractPatientName("help"), null);
  assert.equal(extractPatientName("Start"), null);
});

test("does not extract from messages with contact details or digits", () => {
  assert.equal(extractPatientName("My name is John 2245329236"), null);
  assert.equal(extractPatientName("john@example.com"), null);
  assert.equal(extractPatientName("see https://example.com"), null);
  assert.equal(extractPatientName("Call 224-532-9236"), null);
});

test("rejects non-name and overlong inputs", () => {
  assert.equal(extractPatientName(""), null);
  assert.equal(extractPatientName(null), null);
  assert.equal(extractPatientName("x".repeat(60)), null);
  assert.equal(extractPatientName("My name is the appointment desk team here"), null);
  assert.equal(extractPatientName("office"), null);
  assert.equal(extractPatientName("John Smith Williams Junior"), null); // > 3 words
});
