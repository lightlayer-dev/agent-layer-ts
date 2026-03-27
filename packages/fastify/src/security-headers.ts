/**
 * Fastify plugin: sets security headers on all responses.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { generateSecurityHeaders } from "@agent-layer/core";
import type { SecurityHeadersConfig } from "@agent-layer/core";

export { type SecurityHeadersConfig } from "@agent-layer/core";

/**
 * Fastify plugin that sets security headers on every response.
 * Defaults are safe and score 10/10 on agent-readiness checks.
 */
export function securityHeaders(config: SecurityHeadersConfig = {}) {
  const headers = generateSecurityHeaders(config);

  return fp(
    async function securityHeadersPlugin(fastify: FastifyInstance) {
      fastify.addHook("onRequest", async (_request: FastifyRequest, reply: FastifyReply) => {
        for (const [key, value] of Object.entries(headers)) {
          reply.header(key, value);
        }
      });
    },
    { name: "agent-layer-security-headers" },
  );
}
