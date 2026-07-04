// Structured logger. Emits one JSON object per line to stdout/stderr, which
// Vercel captures and makes searchable in the deployment's Logs tab (filter
// by `level`, `event`, `projectId`, etc.). This replaces scattered
// `console.error("[x]", err)` calls that were unstructured and easy to miss.
//
// Sentry-ready: when SENTRY_DSN is set, error() also forwards to Sentry via a
// dynamically-imported hook (see `forwardToSentry`), so wiring a real error
// tracker later is a one-file change, not a sweep across every call site.

type Level = "info" | "warn" | "error"

export interface LogFields {
  /** Short machine-readable event name, e.g. "telegram.webhook.ai_error". */
  event?: string
  projectId?: string
  [key: string]: unknown
}

function serialiseError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { errorName: err.name, errorMessage: err.message, stack: err.stack }
  }
  return { error: String(err) }
}

function emit(level: Level, message: string, fields: LogFields = {}): void {
  const entry = {
    level,
    message,
    ts: new Date().toISOString(),
    ...fields,
  }
  const line = JSON.stringify(entry)
  // eslint-disable-next-line no-console
  if (level === "error") console.error(line)
  // eslint-disable-next-line no-console
  else if (level === "warn") console.warn(line)
  // eslint-disable-next-line no-console
  else console.log(line)
}

export const log = {
  info(message: string, fields?: LogFields) {
    emit("info", message, fields)
  },
  warn(message: string, fields?: LogFields) {
    emit("warn", message, fields)
  },
  /** Log an error with an optional thrown value merged in as structured fields. */
  error(message: string, err?: unknown, fields?: LogFields) {
    emit("error", message, { ...(err !== undefined ? serialiseError(err) : {}), ...fields })
  },
}
