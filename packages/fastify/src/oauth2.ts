import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import type { OAuth2Config, DecodedAccessToken } from "@agent-layer/core";
import type { OAuth2MiddlewareConfig } from "@agent-layer/core";
import { handleOAuth2, buildOAuth2Metadata } from "@agent-layer/core";

// Extend Fastify request type
declare module "fastify" {
  interface FastifyRequest {
    oauth2Token?: DecodedAccessToken;
  }
}

/**
 * Create OAuth2 middleware and route handlers for Fastify.
 */
export function oauth2Auth(config: OAuth2Config) {
  const metadataDoc = buildOAuth2Metadata(config);

  return {
    metadataPlugin: fp(
      async function oauth2MetadataPlugin(fastify: FastifyInstance) {
        fastify.get("/.well-known/oauth-authorization-server", async (_req, reply) => {
          reply.send(metadataDoc);
        });
      },
      { name: "agent-layer-oauth2-metadata" },
    ),

    requireToken(requiredScopes?: string[]) {
      const mwConfig: OAuth2MiddlewareConfig = {
        oauth2: config,
        requiredScopes,
      };

      return async function oauth2Hook(
        request: FastifyRequest,
        reply: FastifyReply,
      ): Promise<void> {
        const result = await handleOAuth2(request.headers.authorization, mwConfig);

        if (result.pass) {
          request.oauth2Token = result.token;
          return;
        }

        reply.header("WWW-Authenticate", result.wwwAuthenticate);
        reply.status(result.status).send({ error: result.envelope });
      };
    },
  };
}
