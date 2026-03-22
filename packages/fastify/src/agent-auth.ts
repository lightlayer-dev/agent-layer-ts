import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import type { AgentAuthConfig } from "@agent-layer/core";
import { buildOauthDiscoveryDocument, checkRequireAuth } from "@agent-layer/core";

export function agentAuth(config: AgentAuthConfig) {
  const discovery = buildOauthDiscoveryDocument(config);

  return {
    discoveryPlugin: fp(
      async function agentAuthDiscoveryPlugin(fastify: FastifyInstance) {
        fastify.get(
          "/.well-known/oauth-authorization-server",
          async (_request, reply) => {
            reply.send(discovery);
          },
        );
      },
      { name: "agent-layer-auth-discovery" },
    ),

    requireAuth() {
      return async function requireAuthHook(
        request: FastifyRequest,
        reply: FastifyReply,
      ): Promise<void> {
        const result = checkRequireAuth(config, request.headers.authorization);
        if (result.pass) return;
        reply.header("WWW-Authenticate", result.wwwAuthenticate!);
        reply.status(401).send({ error: result.envelope });
      };
    },
  };
}
