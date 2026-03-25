/**
 * Koa middleware: sets security headers on all responses.
 */
import type { Context, Next, Middleware } from "koa";
import { generateSecurityHeaders } from "@agent-layer/core";
import type { SecurityHeadersConfig } from "@agent-layer/core";

export { type SecurityHeadersConfig } from "@agent-layer/core";

/**
 * Koa middleware that sets security headers on every response.
 * Defaults are safe and score 10/10 on agent-readiness checks.
 */
export function securityHeaders(config: SecurityHeadersConfig = {}): Middleware {
  const headers = generateSecurityHeaders(config);

  return async function securityHeadersMiddleware(ctx: Context, next: Next): Promise<void> {
    for (const [key, value] of Object.entries(headers)) {
      ctx.set(key, value);
    }
    await next();
  };
}
