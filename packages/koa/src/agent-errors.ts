import type { Context, Next } from "koa";
import { AgentError, formatError, notFoundError } from "@agent-layer/core";
import type { AgentErrorEnvelope } from "@agent-layer/core";

/**
 * Determine whether the client prefers JSON (i.e., is an agent) based on Accept header.
 */
function prefersJson(ctx: Context): boolean {
  const accept = ctx.headers.accept ?? "";
  if (accept.includes("application/json")) return true;
  if (accept.includes("text/html")) return false;
  // User-agent heuristic: non-browser clients likely want JSON
  const ua = ctx.headers["user-agent"] ?? "";
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

/**
 * Koa error-handling middleware.
 * Content-negotiates between JSON (for agents) and HTML (for browsers).
 * Mount this as the outermost middleware (first `app.use()`) so it catches all downstream errors.
 */
export function agentErrors() {
  return async function agentErrorHandler(
    ctx: Context,
    next: Next,
  ): Promise<void> {
    try {
      await next();
    } catch (err: unknown) {
      const error = err as Error;
      let envelope: AgentErrorEnvelope;

      if (error instanceof AgentError) {
        envelope = error.envelope;
      } else {
        const status =
          (error as unknown as { status?: number }).status ??
          (error as unknown as { statusCode?: number }).statusCode ??
          500;
        envelope = formatError({
          code: "internal_error",
          message: error.message || "An unexpected error occurred.",
          status,
        });
      }

      ctx.status = envelope.status;

      if (envelope.retry_after != null) {
        ctx.set("Retry-After", String(envelope.retry_after));
      }

      if (prefersJson(ctx)) {
        ctx.body = { error: envelope };
      } else {
        ctx.type = "html";
        ctx.body = renderHtmlError(envelope);
      }
    }
  };
}

/**
 * 404 catch-all middleware. Mount after all routes.
 * In Koa, this checks if no downstream middleware set a response body.
 */
export function notFoundHandler() {
  return async function handleNotFound(
    ctx: Context,
    next: Next,
  ): Promise<void> {
    await next();

    // Only trigger 404 if no body was set and status is still 404
    if (ctx.body == null && ctx.status === 404) {
      const envelope = notFoundError(`No route matches ${ctx.method} ${ctx.path}`);
      ctx.status = 404;

      if (prefersJson(ctx)) {
        ctx.body = { error: envelope };
      } else {
        ctx.type = "html";
        ctx.body = renderHtmlError(envelope);
      }
    }
  };
}
