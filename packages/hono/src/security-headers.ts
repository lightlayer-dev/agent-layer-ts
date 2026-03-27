/**
 * Hono middleware: sets security headers on all responses.
 */
import type { Context, Next, MiddlewareHandler } from "hono";
import { generateSecurityHeaders } from "@agent-layer/core";
import type { SecurityHeadersConfig } from "@agent-layer/core";

export { type SecurityHeadersConfig } from "@agent-layer/core";

/**
 * Hono middleware that sets security headers on every response.
 * Defaults are safe and score 10/10 on agent-readiness checks.
 */
export function securityHeaders(config: SecurityHeadersConfig = {}): MiddlewareHandler {
  const headers = generateSecurityHeaders(config);

  return async function securityHeadersMiddleware(c: Context, next: Next): Promise<void> {
    for (const [key, value] of Object.entries(headers)) {
      c.header(key, value);
    }
    await next();
  };
}
