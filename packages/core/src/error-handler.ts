/**
 * Framework-agnostic error handling helpers.
 *
 * These functions extract the duplicated business logic from Express/Koa/Hono/Fastify
 * agent-errors.ts into a single, testable module.
 */

import type { AgentErrorEnvelope } from "./types.js";
import { AgentError, formatError } from "./errors.js";

/**
 * Determine whether the client prefers JSON (i.e., is an agent) based on
 * raw Accept and User-Agent header values.
 */
export function prefersJson(accept?: string, userAgent?: string): boolean {
  const a = accept ?? "";
  if (a.includes("application/json")) return true;
  if (a.includes("text/html")) return false;
  const ua = userAgent ?? "";
  if (!ua || /bot|crawl|spider|agent|curl|httpie|python|node|go-http/i.test(ua)) {
    return true;
  }
  return false;
}

/**
 * Render an error envelope as a simple HTML page.
 */
export function renderHtmlError(envelope: AgentErrorEnvelope): string {
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
 * Build an error envelope from an arbitrary Error object.
 * If the error is an AgentError, uses its existing envelope;
 * otherwise, creates a generic internal_error envelope.
 */
export function buildErrorEnvelope(err: Error): AgentErrorEnvelope {
  if (err instanceof AgentError) {
    return err.envelope;
  }
  const status =
    (err as unknown as { status?: number }).status ??
    (err as unknown as { statusCode?: number }).statusCode ??
    500;
  return formatError({
    code: "internal_error",
    message: err.message || "An unexpected error occurred.",
    status,
  });
}

/**
 * Result of processing an error for response.
 */
export interface ErrorResponseAction {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  isJson: boolean;
}

/**
 * Build a complete error response action from an error and request headers.
 * The caller only needs to apply the result to their framework's response object.
 */
export function buildErrorResponse(
  err: Error,
  accept?: string,
  userAgent?: string,
): ErrorResponseAction {
  const envelope = buildErrorEnvelope(err);
  const headers: Record<string, string> = {};

  if (envelope.retry_after != null) {
    headers["Retry-After"] = String(envelope.retry_after);
  }

  const isJson = prefersJson(accept, userAgent);

  return {
    status: envelope.status,
    headers,
    body: isJson ? { error: envelope } : renderHtmlError(envelope),
    isJson,
  };
}

/**
 * Build a 404 not-found response action.
 */
export function buildNotFoundResponse(
  method: string,
  path: string,
  accept?: string,
  userAgent?: string,
): ErrorResponseAction {
  const envelope = formatError({
    code: "not_found",
    message: `No route matches ${method} ${path}`,
    status: 404,
  });

  const isJson = prefersJson(accept, userAgent);

  return {
    status: 404,
    headers: {},
    body: isJson ? { error: envelope } : renderHtmlError(envelope),
    isJson,
  };
}
