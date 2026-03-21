import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { formatError, validateApiKey, hasScope } from "@agent-layer/core";
import type { ApiKeyConfig, ScopedApiKey } from "@agent-layer/core";

declare module "fastify" {
  interface FastifyRequest {
    agentKey?: ScopedApiKey;
  }
}

/**
 * Fastify plugin that extracts and validates an API key from a request header.
 * Attaches the resolved key to `request.agentKey` on success.
 */
export function apiKeyAuth(config: ApiKeyConfig) {
  const headerName = config.headerName ?? "X-Agent-Key";
  const headerLower = headerName.toLowerCase();

  return fp(
    async function apiKeyAuthPlugin(fastify: FastifyInstance) {
      fastify.decorateRequest("agentKey", undefined);

      fastify.addHook(
        "onRequest",
        async (request: FastifyRequest, reply: FastifyReply) => {
          const rawKey = request.headers[headerLower] as string | undefined;

          if (!rawKey) {
            const envelope = formatError({
              code: "api_key_missing",
              message: `Missing required header: ${headerName}`,
              status: 401,
            });
            reply.status(401).send({ error: envelope });
            return;
          }

          const result = await validateApiKey(config.store, rawKey);

          if (!result.valid) {
            const envelope = formatError({
              code: result.error!,
              message:
                result.error === "api_key_expired"
                  ? "The API key has expired."
                  : "The API key is invalid.",
              status: 401,
            });
            reply.status(401).send({ error: envelope });
            return;
          }

          request.agentKey = result.key;
        },
      );
    },
    { name: "agent-layer-api-keys" },
  );
}

/**
 * Fastify preHandler hook that checks if the authenticated API key has the required scope(s).
 * Must be used after `apiKeyAuth()`.
 */
export function requireScope(scope: string | string[]) {
  return async function requireScopeHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.agentKey) {
      const envelope = formatError({
        code: "api_key_missing",
        message: "Authentication required before scope check.",
        status: 401,
      });
      reply.status(401).send({ error: envelope });
      return;
    }

    if (!hasScope(request.agentKey, scope)) {
      const required = Array.isArray(scope) ? scope.join(", ") : scope;
      const envelope = formatError({
        code: "insufficient_scope",
        message: `Required scope(s): ${required}`,
        status: 403,
      });
      reply.status(403).send({ error: envelope });
    }
  };
}
