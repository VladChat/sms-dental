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

test("extracts names from explicit inline name phrases", () => {
  assert.equal(extractPatientName("use Alex Sikorsky as my name"), "Alex Sikorsky");
  assert.equal(extractPatientName("use Alex Sikorsky as it's my name"), "Alex Sikorsky");
  assert.equal(extractPatientName("use Alex Sikorsky as it is my name"), "Alex Sikorsky");
  assert.equal(extractPatientName("Alex Sikorsky is my name"), "Alex Sikorsky");
  assert.equal(extractPatientName("my name should be Alex Sikorsky"), "Alex Sikorsky");
  assert.equal(extractPatientName("you can use Alex Sikorsky"), "Alex Sikorsky");
  assert.equal(extractPatientName("call me Alex"), "Alex");
});

test("extracts names from inline phrases inside longer real messages", () => {
  assert.equal(
    extractPatientName("Ok. maybe, use alex sikorsky as it's my name appointment need tomorrow"),
    "Alex Sikorsky",
  );
  assert.equal(
    extractPatientName("Ok. maybe, use Alex Sikorsky as my name. appointment need tomorrow"),
    "Alex Sikorsky",
  );
  assert.equal(
    extractPatientName("Pain. Use Alex Sikorsky as my name. appointment tomorrow"),
    "Alex Sikorsky",
  );
  assert.equal(extractPatientName("Hi, my name is John"), "John");
  assert.equal(extractPatientName("Sure. you can call me Sarah"), "Sarah");
});

test("inline phrases still fail closed on request/filler/safety content", () => {
  assert.equal(extractPatientName("call me later"), null);
  assert.equal(extractPatientName("call me back tomorrow"), null);
  assert.equal(extractPatientName("call me when you can"), null);
  assert.equal(extractPatientName("you can use whatever"), null);
  assert.equal(extractPatientName("use tooth pain as my name"), null);
  assert.equal(extractPatientName("my name should be the office"), null);
  assert.equal(extractPatientName("severe pain"), null);
  assert.equal(extractPatientName("emergency"), null);
});

test("does not extract from request-only messages", () => {
  assert.equal(extractPatientName("appointment need tomorrow"), null);
  assert.equal(extractPatientName("I need an appointment as soon as possible"), null);
});
