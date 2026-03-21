import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import type { AgentAuthConfig } from "@agent-layer/core";
import { formatError } from "@agent-layer/core";

/**
 * Generate the OAuth discovery document.
 */
function oauthDiscoveryDocument(config: AgentAuthConfig): Record<string, unknown> {
  const doc: Record<string, unknown> = {};

  if (config.issuer) doc["issuer"] = config.issuer;
  if (config.authorizationUrl) doc["authorization_endpoint"] = config.authorizationUrl;
  if (config.tokenUrl) doc["token_endpoint"] = config.tokenUrl;
  if (config.scopes) doc["scopes_supported"] = Object.keys(config.scopes);

  return doc;
}

/**
 * Fastify plugin that registers OAuth discovery and requireAuth hook.
 */
export function agentAuth(config: AgentAuthConfig) {
  const realm = config.realm ?? "api";
  const discovery = oauthDiscoveryDocument(config);

  return {
    /**
     * Plugin that registers the OAuth discovery endpoint.
     */
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

    /**
     * Hook function for requiring auth on specific routes.
     */
    requireAuth() {
      return async function requireAuthHook(
        request: FastifyRequest,
        reply: FastifyReply,
      ): Promise<void> {
        const authHeader = request.headers.authorization;

        if (!authHeader) {
          const wwwAuth = [`Bearer realm="${realm}"`];
          if (config.scopes) {
            wwwAuth.push(`scope="${Object.keys(config.scopes).join(" ")}"`);
          }
          reply.header("WWW-Authenticate", wwwAuth.join(", "));

          const envelope = formatError({
            code: "authentication_required",
            message: "This endpoint requires authentication.",
            status: 401,
            docs_url: config.authorizationUrl,
          });

          reply.status(401).send({ error: envelope });
        }
      };
    },
  };
}
