import type { Context, Next } from "koa";
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

declare module "koa" {
  interface DefaultState {
    agentIdentity?: AgentIdentityClaims;
  }
}

/**
 * Koa middleware for agent identity verification and authorization.
 * See IETF draft-klrc-aiagent-auth-00.
 */
export function agentIdentity(config: AgentIdentityConfig) {
  const headerName = (config.headerName ?? "authorization").toLowerCase();
  const prefix = config.tokenPrefix ?? "Bearer";

  async function extractAndVerify(ctx: Context): Promise<AgentIdentityClaims | null> {
    const rawHeader = ctx.get(headerName);
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
    requireIdentity() {
      return async function requireIdentityMiddleware(
        ctx: Context,
        next: Next,
      ): Promise<void> {
        const rawHeader = ctx.get(headerName);
        if (!rawHeader) {
          ctx.status = 401;
          ctx.body = {
            error: formatError({
              code: "agent_identity_required",
              message: "Agent identity token is required.",
              status: 401,
            }),
          };
          return;
        }

        const claims = await extractAndVerify(ctx);
        if (!claims) {
          ctx.status = 401;
          ctx.body = {
            error: formatError({
              code: config.verifyToken ? "verification_failed" : "malformed_token",
              message: config.verifyToken
                ? "Agent identity token verification failed."
                : "Agent identity token is malformed.",
              status: 401,
            }),
          };
          return;
        }

        const validationError = validateClaims(claims, config);
        if (validationError) {
          const status = validationError.code === "expired_token" ? 401 : 403;
          ctx.status = status;
          ctx.body = {
            error: formatError({
              code: validationError.code,
              message: validationError.message,
              status,
            }),
          };
          return;
        }

        ctx.state.agentIdentity = claims;

        if (config.policies && config.policies.length > 0) {
          const context: AuthzContext = {
            method: ctx.method,
            path: ctx.path,
            headers: ctx.headers as Record<string, string | undefined>,
          };

          const authzResult = evaluateAuthz(
            claims,
            context,
            config.policies,
            config.defaultPolicy,
          );

          if (!authzResult.allowed) {
            ctx.status = 403;
            ctx.body = {
              error: formatError({
                code: "agent_unauthorized",
                message: authzResult.deniedReason ?? "Agent is not authorized.",
                status: 403,
              }),
            };
            return;
          }
        }

        await next();
      };
    },

    optionalIdentity() {
      return async function optionalIdentityMiddleware(
        ctx: Context,
        next: Next,
      ): Promise<void> {
        try {
          const claims = await extractAndVerify(ctx);
          if (claims) {
            const err = validateClaims(claims, config);
            if (!err) ctx.state.agentIdentity = claims;
          }
        } catch {
          // Silently ignore
        }
        await next();
      };
    },
  };
}
