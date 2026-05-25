// Minimal structured logger. Writes a single JSON line per event to stdout/stderr.
// Never log secret values. Use field names like `present` (boolean) when
// referencing the existence of a secret.

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const SECRET_KEY_RE =
  /(token|secret|password|api[_-]?key|auth|signature|sid)/i;

function redact(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "string" && SECRET_KEY_RE.test(k)) {
      out[k] = "[redacted]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redact(v as LogFields);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: LogLevel, message: string, fields?: LogFields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...(fields ? redact(fields) : {}),
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};

export type Logger = typeof logger;
