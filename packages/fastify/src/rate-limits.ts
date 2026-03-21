import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { createRateLimiter, rateLimitError } from "@agent-layer/core";
import type { RateLimitConfig } from "@agent-layer/core";

/**
 * Fastify plugin that adds X-RateLimit-* headers to every response
 * and returns 429 with Retry-After when the limit is exceeded.
 */
export function rateLimits(config: RateLimitConfig) {
  return fp(
    async function rateLimitsPlugin(fastify: FastifyInstance) {
      const check = createRateLimiter(config);

      fastify.addHook(
        "onRequest",
        async (request: FastifyRequest, reply: FastifyReply) => {
          const result = await check(request.raw);

          reply.header("X-RateLimit-Limit", String(result.limit));
          reply.header("X-RateLimit-Remaining", String(result.remaining));
          reply.header(
            "X-RateLimit-Reset",
            String(Math.ceil((Date.now() + result.resetMs) / 1000)),
          );

          if (!result.allowed) {
            const retryAfter =
              result.retryAfter ?? Math.ceil(result.resetMs / 1000);
            reply.header("Retry-After", String(retryAfter));
            const envelope = rateLimitError(retryAfter);
            reply.status(429).send({ error: envelope });
          }
        },
      );
    },
    { name: "agent-layer-rate-limits" },
  );
}
