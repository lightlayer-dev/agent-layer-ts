import type { Request, Response, NextFunction } from "express";
import { createRateLimiter, rateLimitError } from "@agent-layer/core";
import type { RateLimitConfig } from "@agent-layer/core";

/**
 * Express middleware that adds X-RateLimit-* headers to every response
 * and returns 429 with Retry-After when the limit is exceeded.
 */
export function rateLimits(config: RateLimitConfig) {
  const check = createRateLimiter(config);

  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await check(req);

      res.setHeader("X-RateLimit-Limit", String(result.limit));
      res.setHeader("X-RateLimit-Remaining", String(result.remaining));
      res.setHeader(
        "X-RateLimit-Reset",
        String(Math.ceil((Date.now() + result.resetMs) / 1000)),
      );

      if (!result.allowed) {
        const retryAfter = result.retryAfter ?? Math.ceil(result.resetMs / 1000);
        res.setHeader("Retry-After", String(retryAfter));
        const envelope = rateLimitError(retryAfter);
        res.status(429).json({ error: envelope });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
