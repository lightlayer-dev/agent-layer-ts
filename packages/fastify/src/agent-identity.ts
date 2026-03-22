import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import type { AgentIdentityConfig, AgentIdentityClaims } from "@agent-layer/core";
import { handleRequireIdentity, handleOptionalIdentity } from "@agent-layer/core";

declare module "fastify" {
  interface FastifyRequest {
    agentIdentity?: AgentIdentityClaims;
  }
}

export function agentIdentity(config: AgentIdentityConfig) {
  const headerName = (config.headerName ?? "authorization").toLowerCase();

  return {
    plugin: fp(
      async function agentIdentityPlugin(fastify: FastifyInstance) {
        fastify.decorateRequest("agentIdentity", undefined);
      },
      { name: "agent-layer-identity" },
    ),

    requireIdentity() {
      return async function requireIdentityHook(
        request: FastifyRequest,
        reply: FastifyReply,
      ): Promise<void> {
        const rawHeader = request.headers[headerName] as string | undefined;

        const result = await handleRequireIdentity(rawHeader, config, {
          method: request.method,
          path: request.url,
          headers: request.headers as Record<string, string | undefined>,
        });

        if ("error" in result) {
          reply.status(result.error.status).send({ error: result.error.envelope });
          return;
        }

        request.agentIdentity = result.claims;
      };
    },

    optionalIdentity() {
      return async function optionalIdentityHook(
        request: FastifyRequest,
      ): Promise<void> {
        const rawHeader = request.headers[headerName] as string | undefined;
        const claims = await handleOptionalIdentity(rawHeader, config);
        if (claims) request.agentIdentity = claims;
      };
    },
  };
}
