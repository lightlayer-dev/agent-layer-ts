import type { Context, Next } from "hono";
import { createRateLimiter, rateLimitError } from "@agent-layer/core";
import type { RateLimitConfig } from "@agent-layer/core";

/**
 * Hono middleware that adds X-RateLimit-* headers to every response
 * and returns 429 with Retry-After when the limit is exceeded.
 */
export function rateLimits(config: RateLimitConfig) {
  const check = createRateLimiter(config);

  return async function rateLimitMiddleware(c: Context, next: Next): Promise<Response | void> {
    const result = await check(c.req.raw);

    c.header("X-RateLimit-Limit", String(result.limit));
    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header(
      "X-RateLimit-Reset",
      String(Math.ceil((Date.now() + result.resetMs) / 1000)),
    );

    if (!result.allowed) {
      const retryAfter = result.retryAfter ?? Math.ceil(result.resetMs / 1000);
      c.header("Retry-After", String(retryAfter));
      const envelope = rateLimitError(retryAfter);
      return c.json({ error: envelope }, 429);
    }

    await next();
  };
}
