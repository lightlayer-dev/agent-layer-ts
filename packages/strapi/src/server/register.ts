import { formatError, createRateLimiter } from "@agent-layer/core";
import type { RateLimitConfig } from "@agent-layer/core";

interface StrapiInstance {
  config: {
    get: (key: string, defaultValue?: unknown) => unknown;
  };
  server: {
    use: (middleware: unknown) => void;
  };
}

interface KoaContext {
  path: string;
  status: number;
  body: unknown;
  set: (key: string, value: string) => void;
  ip: string;
}

type KoaNext = () => Promise<void>;

/**
 * Register phase — runs before bootstrap.
 * Registers global Koa middleware for error formatting and rate limiting.
 */
export function register({ strapi }: { strapi: StrapiInstance }): void {
  const pluginConfig = strapi.config.get("plugin.agent-layer", {}) as Record<string, unknown>;
  const rateLimitOpts = pluginConfig.rateLimit as Partial<RateLimitConfig> | undefined;

  // Create rate limiter if configured
  const checkRateLimit = rateLimitOpts
    ? createRateLimiter({
        max: (rateLimitOpts.max as number) ?? 100,
        windowMs: (rateLimitOpts.windowMs as number) ?? 60_000,
        keyFn: (req: unknown) => (req as KoaContext).ip ?? "__global__",
      })
    : null;

  strapi.server.use(async (ctx: KoaContext, next: KoaNext) => {
    // Only apply to /api/ routes
    if (!ctx.path.startsWith("/api/")) {
      return next();
    }

    // Rate limiting
    if (checkRateLimit) {
      const result = await checkRateLimit(ctx);
      ctx.set("X-RateLimit-Limit", String(result.limit));
      ctx.set("X-RateLimit-Remaining", String(result.remaining));
      ctx.set("X-RateLimit-Reset", String(Math.ceil(result.resetMs / 1000)));

      if (!result.allowed) {
        const error = formatError({
          code: "rate_limit_exceeded",
          message: "Too many requests. Please retry after the specified time.",
          status: 429,
          is_retriable: true,
          retry_after: result.retryAfter,
        });
        ctx.status = 429;
        ctx.body = { error };
        return;
      }
    }

    // Structured error handling
    try {
      await next();
    } catch (err: unknown) {
      const status =
        (err as { status?: number }).status ??
        (err as { statusCode?: number }).statusCode ??
        500;
      const message =
        (err as { message?: string }).message ?? "Internal server error";

      const error = formatError({
        code: status === 404 ? "not_found" : status === 400 ? "bad_request" : "internal_error",
        message,
        status,
      });

      ctx.status = status;
      ctx.body = { error };
    }
  });
}
