// Standalone Twilio ConversationRelay WebSocket relay service.
//
//   GET  /health                      -> { ok: true } (or 503 + safe reason)
//   WS   /twilio/conversation-relay    -> ConversationRelay session
//
// Deploys independently from the Next app. The Next app's Twilio voice webhook
// decides (test_only + allowlist) whether to return ConversationRelay TwiML that
// points here. This service authenticates the session (signed token + optional
// X-Twilio-Signature + runtime gate), runs the text brain, and persists ONLY the
// narrow captured request via the shared session lifecycle. No transcripts,
// audio, raw Twilio messages, prompts, or OpenAI responses are stored. Logs
// carry only safe metadata (call sid tail, clinic id, reason codes).

import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import OpenAI from "openai";

import {
  evaluateAiAnsweringRuntimeGate,
  getAiAnsweringRuntimeConfig,
  getAiFrontDeskRuntimeContext,
  logger,
} from "./shared-lib";
import { getRelayConfigError, getRelayServiceConfig } from "./relay-config";
import {
  endMessage,
  parseInboundMessage,
  textMessage,
  validateConversationRelaySetup,
} from "./twilio-messages";
import {
  createDeterministicBrain,
  createOpenAiBrain,
  type FrontDeskBrain,
  type OpenAiResponsesClient,
} from "./openai-brain";
import { createDbSessionLifecycle } from "./lifecycle";
import {
  handleClose,
  handleDtmf,
  handleError,
  handlePrompt,
  handleSetup,
  type HandlerDeps,
  type RelayOutbound,
} from "./conversation-handler";
import { createRelaySessionState, type RelaySessionState } from "./session-state";
import { checkTwilioUpgradeSignature } from "./twilio-signature";

const config = getRelayServiceConfig();

function tail(value: string): string {
  return value.length <= 6 ? value : value.slice(-6);
}

function buildBrain(): { brain: FrontDeskBrain; kind: string } {
  if (config.openaiApiKey) {
    const client = new OpenAI({ apiKey: config.openaiApiKey }) as unknown as OpenAiResponsesClient;
    return {
      brain: createOpenAiBrain({
        client,
        model: config.openaiModel,
        onError: (code) => logger.warn("relay.brain_error", { code }),
      }),
      kind: "openai",
    };
  }
  // No key: deterministic brain (used only when explicitly allowed; otherwise the
  // config error path refuses sessions before the brain is ever reached).
  return { brain: createDeterministicBrain(), kind: config.allowFallbackBrain ? "fallback" : "unconfigured" };
}

const { brain, kind: brainKind } = buildBrain();

const deps: HandlerDeps = {
  brain,
  lifecycle: createDbSessionLifecycle(),
  loadContext: async (clinicId, clinicName) => getAiFrontDeskRuntimeContext(clinicId, clinicName),
  onWarn: (code) => logger.warn("relay.handler_warn", { code }),
};

function makeOutbound(ws: WebSocket): RelayOutbound {
  return {
    sendText(text, opts) {
      ws.send(JSON.stringify(textMessage(text, { last: opts?.last ?? true })));
    },
    sendEnd(handoffData) {
      ws.send(JSON.stringify(endMessage(handoffData)));
    },
  };
}

function onConnection(ws: WebSocket): void {
  let state: RelaySessionState | null = null;
  const send = makeOutbound(ws);

  ws.on("message", async (data) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return; // ignore non-JSON frames
    }
    const msg = parseInboundMessage(parsed);

    try {
      switch (msg.kind) {
        case "setup": {
          const validation = validateConversationRelaySetup(msg.message, {
            secret: config.signingSecret as string,
            maxAgeMs: config.tokenMaxAgeMs,
          });
          if (!validation.ok) {
            logger.warn("relay.setup_rejected", { reason: validation.reason });
            ws.close(1008, "unauthorized");
            return;
          }
          const { clinicId, callSid, from, to } = validation.customParameters;

          // Re-check the runtime gate (mode + allowlist) inside the relay.
          const aiConfig = getAiAnsweringRuntimeConfig();
          const decision = evaluateAiAnsweringRuntimeGate({
            mode: aiConfig.mode,
            clinicId,
            clinicActive: true,
            callerPhone: from,
            clinicPhone: to,
            numberRoutingStatus: "active",
            testClinicIds: aiConfig.testClinicIds,
            testCallerNumbers: aiConfig.testCallerNumbers,
          });
          if (!decision.ok) {
            logger.warn("relay.gate_blocked", {
              reason: decision.reason,
              clinicId,
              callSidTail: tail(callSid),
            });
            ws.close(1008, "not allowed");
            return;
          }

          state = createRelaySessionState({ clinicId, callSid, from, to });
          await handleSetup(deps, state);
          logger.info("relay.session_started", { clinicId, callSidTail: tail(callSid) });
          break;
        }
        case "prompt": {
          if (!state) return;
          await handlePrompt(
            deps,
            state,
            { text: msg.message.voicePrompt ?? "", last: msg.message.last === true },
            send,
          );
          break;
        }
        case "dtmf": {
          handleDtmf(send);
          break;
        }
        case "interrupt": {
          // Tolerate safely — nothing to do, do not crash.
          break;
        }
        case "error": {
          logger.warn("relay.provider_error", { description: msg.description ?? null });
          if (state) await handleError(deps, state);
          break;
        }
        default:
          break;
      }
    } catch (err) {
      logger.error("relay.message_failed", {
        kind: msg.kind,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  });

  ws.on("close", async () => {
    if (!state) return;
    try {
      await handleClose(deps, state);
      logger.info("relay.session_closed", {
        clinicId: state.clinicId,
        callSidTail: tail(state.callSid),
        status: state.status,
      });
    } catch (err) {
      logger.error("relay.close_failed", {
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  });

  ws.on("error", (err) => {
    logger.warn("relay.ws_error", { message: err instanceof Error ? err.message : "unknown" });
  });
}

function start(): void {
  const server = http.createServer((req, res) => {
    const pathname = (req.url ?? "").split("?")[0];
    if (req.method === "GET" && pathname === "/health") {
      const configError = getRelayConfigError(config);
      const status = configError ? 503 : 200;
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(configError ? { ok: false, error: configError } : { ok: true }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });

  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", onConnection);

  server.on("upgrade", (req, socket, head) => {
    const pathname = (req.url ?? "").split("?")[0];
    if (pathname !== config.wsPath) {
      socket.destroy();
      return;
    }
    const configError = getRelayConfigError(config);
    if (configError) {
      logger.error("relay.upgrade_refused_misconfigured", { reason: configError });
      socket.destroy();
      return;
    }
    const sig = checkTwilioUpgradeSignature(req, config.twilioAuthToken);
    if (sig === "invalid") {
      logger.warn("relay.twilio_signature_invalid", { enforced: config.enforceTwilioSignature });
      if (config.enforceTwilioSignature) {
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });

  server.listen(config.port, () => {
    const configError = getRelayConfigError(config);
    logger.info("relay.listening", {
      port: config.port,
      wsPath: config.wsPath,
      brain: brainKind,
      healthy: configError === null,
      configError,
    });
  });
}

// Only start when run directly (so tests can import sibling modules safely).
if (require.main === module) {
  start();
}

export { start };
