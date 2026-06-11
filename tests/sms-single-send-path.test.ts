import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

// Static guard: every automated SMS send must go through one of the two fully
// guarded send modules. A Twilio Messages API call site anywhere else in app/ or
// lib/ would bypass the mode/readiness/opt-out/duplicate guards, so this test
// fails if one appears.
//   - lib/twilio/outbound-sms.ts — missed-call recovery SMS (sendRecoverySms).
//   - lib/twilio/conversation-auto-reply.ts — deterministic conversation
//     auto-replies (maybeSendConversationAutoReply); enforces its own mode,
//     exact-number readiness, clinic gate, opt-out, max-replies, enabled-slot,
//     prior-recovery, keyword and duplicate guards.

const REPO_ROOT = process.cwd();
const ALLOWED_SEND_FILES = new Set([
  path.join("lib", "twilio", "outbound-sms.ts"),
  path.join("lib", "twilio", "conversation-auto-reply.ts"),
]);

// Drop // and /* */ comment lines so doc references to a function name do not
// count as call sites.
function stripCommentLines(source: string): string {
  return source
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("*") &&
        !trimmed.startsWith("/*")
      );
    })
    .join("\n");
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

test("messages.create is called only from the guarded send modules", () => {
  const files = [
    ...listSourceFiles(path.join(REPO_ROOT, "app")),
    ...listSourceFiles(path.join(REPO_ROOT, "lib")),
  ];
  const offenders: string[] = [];
  for (const file of files) {
    const source = stripCommentLines(fs.readFileSync(file, "utf8"));
    if (/\bmessages\s*\.\s*create\s*\(/.test(source)) {
      const rel = path.relative(REPO_ROOT, file);
      if (!ALLOWED_SEND_FILES.has(rel)) offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Twilio messages.create() must only be called from a guarded send module ` +
      `(${[...ALLOWED_SEND_FILES].join(", ")}). Offenders: ${offenders.join(", ")}`,
  );
});

test("sendRecoverySms is invoked only from the voice status webhook", () => {
  const files = [
    ...listSourceFiles(path.join(REPO_ROOT, "app")),
    ...listSourceFiles(path.join(REPO_ROOT, "lib")),
  ];
  const allowedCallers = new Set([
    path.join("app", "api", "webhooks", "twilio", "voice", "status", "route.ts"),
    path.join("lib", "twilio", "outbound-sms.ts"),
  ]);
  const offenders: string[] = [];
  for (const file of files) {
    const source = stripCommentLines(fs.readFileSync(file, "utf8"));
    if (/\bsendRecoverySms\s*\(/.test(source)) {
      const rel = path.relative(REPO_ROOT, file);
      if (!allowedCallers.has(rel)) offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `sendRecoverySms() has an unexpected caller: ${offenders.join(", ")}`,
  );
});
