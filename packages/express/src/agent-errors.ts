import type { Request, Response, NextFunction } from "express";
import { AgentError, formatError, notFoundError } from "@agent-layer/core";
import type { AgentErrorEnvelope } from "@agent-layer/core";

/**
 * Determine whether the client prefers JSON (i.e., is an agent) based on Accept header.
 */
function prefersJson(req: Request): boolean {
  const accept = req.headers.accept ?? "";
  if (accept.includes("application/json")) return true;
  if (accept.includes("text/html")) return false;
  // User-agent heuristic: non-browser clients likely want JSON
  const ua = req.headers["user-agent"] ?? "";
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
 * Express error-handling middleware (4-arg signature).
 * Content-negotiates between JSON (for agents) and HTML (for browsers).
 */
export function agentErrors() {
  return function agentErrorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
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

    res.status(envelope.status);

    if (envelope.retry_after != null) {
      res.setHeader("Retry-After", String(envelope.retry_after));
    }

    if (prefersJson(req)) {
      res.json({ error: envelope });
    } else {
      res.type("html").send(renderHtmlError(envelope));
    }
  };
}

/**
 * 404 catch-all middleware. Mount after all routes.
 */
export function notFoundHandler() {
  return function handleNotFound(req: Request, res: Response, _next: NextFunction): void {
    const envelope = notFoundError(`No route matches ${req.method} ${req.path}`);
    res.status(404);

    if (prefersJson(req)) {
      res.json({ error: envelope });
    } else {
      res.type("html").send(renderHtmlError(envelope));
    }
  };
}
