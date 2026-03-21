import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import type {
  AgentIdentityConfig,
  AgentIdentityClaims,
  AuthzContext,
} from "@agent-layer/core";
import {
  decodeJwtClaims,
  extractClaims,
  validateClaims,
  evaluateAuthz,
  formatError,
} from "@agent-layer/core";

declare module "fastify" {
  interface FastifyRequest {
    agentIdentity?: AgentIdentityClaims;
  }
}

/**
 * Fastify plugin for agent identity verification and authorization.
 * See IETF draft-klrc-aiagent-auth-00.
 */
export function agentIdentity(config: AgentIdentityConfig) {
  const headerName = (config.headerName ?? "authorization").toLowerCase();
  const prefix = config.tokenPrefix ?? "Bearer";

  async function extractAndVerify(
    request: FastifyRequest,
  ): Promise<AgentIdentityClaims | null> {
    const rawHeader = request.headers[headerName] as string | undefined;
    if (!rawHeader) return null;

    const token = rawHeader.startsWith(prefix + " ")
      ? rawHeader.slice(prefix.length + 1)
      : rawHeader;

    if (config.verifyToken) {
      return await config.verifyToken(token);
    }

    const payload = decodeJwtClaims(token);
    if (!payload) return null;
    return extractClaims(payload);
  }

  return {
    /**
     * Plugin that decorates request with agentIdentity.
     */
    plugin: fp(
      async function agentIdentityPlugin(fastify: FastifyInstance) {
        fastify.decorateRequest("agentIdentity", undefined);
      },
      { name: "agent-layer-identity" },
    ),

    /**
     * PreHandler hook that requires agent identity.
     */
    requireIdentity() {
      return async function requireIdentityHook(
        request: FastifyRequest,
        reply: FastifyReply,
      ): Promise<void> {
        const rawHeader = request.headers[headerName] as string | undefined;
        if (!rawHeader) {
          reply.status(401).send({
            error: formatError({
              code: "agent_identity_required",
              message: "Agent identity token is required.",
              status: 401,
            }),
          });
          return;
        }

        const claims = await extractAndVerify(request);
        if (!claims) {
          reply.status(401).send({
            error: formatError({
              code: config.verifyToken
                ? "verification_failed"
                : "malformed_token",
              message: config.verifyToken
                ? "Agent identity token verification failed."
                : "Agent identity token is malformed.",
              status: 401,
            }),
          });
          return;
        }

        const validationError = validateClaims(claims, config);
        if (validationError) {
          const status =
            validationError.code === "expired_token" ? 401 : 403;
          reply.status(status).send({
            error: formatError({
              code: validationError.code,
              message: validationError.message,
              status,
            }),
          });
          return;
        }

        request.agentIdentity = claims;

        if (config.policies && config.policies.length > 0) {
          const context: AuthzContext = {
            method: request.method,
            path: request.url,
            headers: request.headers as Record<string, string | undefined>,
          };

          const authzResult = evaluateAuthz(
            claims,
            context,
            config.policies,
            config.defaultPolicy,
          );

          if (!authzResult.allowed) {
            reply.status(403).send({
              error: formatError({
                code: "agent_unauthorized",
                message:
                  authzResult.deniedReason ?? "Agent is not authorized.",
                status: 403,
              }),
            });
          }
        }
      };
    },

    /**
     * PreHandler hook that optionally extracts identity.
     */
    optionalIdentity() {
      return async function optionalIdentityHook(
        request: FastifyRequest,
      ): Promise<void> {
        try {
          const claims = await extractAndVerify(request);
          if (claims) {
            const err = validateClaims(claims, config);
            if (!err) request.agentIdentity = claims;
          }
        } catch {
          // Silently ignore
        }
      };
    },
  };
}
