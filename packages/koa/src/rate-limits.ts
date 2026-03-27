import type { Context, Next } from "koa";
import { createRateLimiter, rateLimitError } from "@agent-layer/core";
import type { RateLimitConfig } from "@agent-layer/core";

/**
 * Koa middleware that adds X-RateLimit-* headers to every response
 * and returns 429 with Retry-After when the limit is exceeded.
 */
export function rateLimits(config: RateLimitConfig) {
  const check = createRateLimiter(config);

  return async function rateLimitMiddleware(
    ctx: Context,
    next: Next,
  ): Promise<void> {
    const result = await check(ctx.request);

    ctx.set("X-RateLimit-Limit", String(result.limit));
    ctx.set("X-RateLimit-Remaining", String(result.remaining));
    ctx.set(
      "X-RateLimit-Reset",
      String(Math.ceil((Date.now() + result.resetMs) / 1000)),
    );

    if (!result.allowed) {
      const retryAfter = result.retryAfter ?? Math.ceil(result.resetMs / 1000);
      ctx.set("Retry-After", String(retryAfter));
      const envelope = rateLimitError(retryAfter);
      ctx.status = 429;
      ctx.body = { error: envelope };
      return;
    }

    await next();
  };
}
