import type { Context, Next, Hono, ErrorHandler } from "hono";
import { AgentError, formatError, notFoundError } from "@agent-layer/core";
import type { AgentErrorEnvelope } from "@agent-layer/core";

/**
 * Determine whether the client prefers JSON (i.e., is an agent) based on Accept header.
 */
function prefersJson(c: Context): boolean {
  const accept = c.req.header("accept") ?? "";
  if (accept.includes("application/json")) return true;
  if (accept.includes("text/html")) return false;
  const ua = c.req.header("user-agent") ?? "";
  if (!ua || /bot|crawl|spider|agent|curl|httpie|python|node|go-http/i.test(ua)) {
    return true;
  }
  return false;
}

function renderHtmlError(envelope: AgentErrorEnvelope): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Error ${envelope.status}</title></head>
<body>
  <h1>${envelope.status} — ${envelope.code}</h1>
  <p>${envelope.message}</p>
</body>
</html>`;
}

function handleError(err: Error, c: Context): Response {
  let envelope: AgentErrorEnvelope;

  if (err instanceof AgentError) {
    envelope = err.envelope;
  } else {
    const status =
      (err as unknown as { status?: number }).status ??
      (err as unknown as { statusCode?: number }).statusCode ??
      500;
    envelope = formatError({
      code: "internal_error",
      message: err.message || "An unexpected error occurred.",
      status,
    });
  }

  if (envelope.retry_after != null) {
    c.header("Retry-After", String(envelope.retry_after));
  }

  if (prefersJson(c)) {
    return c.json({ error: envelope }, envelope.status as any);
  } else {
    return c.html(renderHtmlError(envelope), envelope.status as any);
  }
}

/**
 * Hono error-handling middleware.
 * Returns an `onError` handler to register on the Hono app.
 *
 * Usage:
 * ```ts
 * const app = new Hono();
 * app.onError(agentErrors());
 * ```
 */
export function agentErrors(): ErrorHandler {
  return (err: Error, c: Context) => handleError(err, c);
}

/**
 * 404 catch-all handler for Hono.
 * Returns a `notFound` handler to register on the Hono app.
 *
 * Usage:
 * ```ts
 * app.notFound(notFoundHandler());
 * ```
 */
export function notFoundHandler() {
  return (c: Context): Response => {
    const envelope = notFoundError(`No route matches ${c.req.method} ${c.req.path}`);

    if (prefersJson(c)) {
      return c.json({ error: envelope }, 404);
    } else {
      return c.html(renderHtmlError(envelope), 404);
    }
  };
}
