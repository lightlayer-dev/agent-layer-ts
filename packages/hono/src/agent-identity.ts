import type { Context, Next } from "hono";
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

/**
 * Hono middleware for agent identity verification and authorization.
 * See IETF draft-klrc-aiagent-auth-00.
 */
export function agentIdentity(config: AgentIdentityConfig) {
  const headerName = (config.headerName ?? "authorization").toLowerCase();
  const prefix = config.tokenPrefix ?? "Bearer";

  async function extractAndVerify(c: Context): Promise<AgentIdentityClaims | null> {
    const rawHeader = c.req.header(headerName);
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
        c: Context,
        next: Next,
      ): Promise<Response | void> {
        const rawHeader = c.req.header(headerName);
        if (!rawHeader) {
          return c.json(
            {
              error: formatError({
                code: "agent_identity_required",
                message: "Agent identity token is required.",
                status: 401,
              }),
            },
            401,
          );
        }

        const claims = await extractAndVerify(c);
        if (!claims) {
          return c.json(
            {
              error: formatError({
                code: config.verifyToken ? "verification_failed" : "malformed_token",
                message: config.verifyToken
                  ? "Agent identity token verification failed."
                  : "Agent identity token is malformed.",
                status: 401,
              }),
            },
            401,
          );
        }

        const validationError = validateClaims(claims, config);
        if (validationError) {
          const status = validationError.code === "expired_token" ? 401 : 403;
          return c.json(
            {
              error: formatError({
                code: validationError.code,
                message: validationError.message,
                status,
              }),
            },
            status as any,
          );
        }

        c.set("agentIdentity", claims);

        if (config.policies && config.policies.length > 0) {
          const headers: Record<string, string | undefined> = {};
          c.req.raw.headers.forEach((value, key) => {
            headers[key] = value;
          });

          const context: AuthzContext = {
            method: c.req.method,
            path: c.req.path,
            headers,
          };

          const authzResult = evaluateAuthz(
            claims,
            context,
            config.policies,
            config.defaultPolicy,
          );

          if (!authzResult.allowed) {
            return c.json(
              {
                error: formatError({
                  code: "agent_unauthorized",
                  message: authzResult.deniedReason ?? "Agent is not authorized.",
                  status: 403,
                }),
              },
              403,
            );
          }
        }

        await next();
      };
    },

    optionalIdentity() {
      return async function optionalIdentityMiddleware(
        c: Context,
        next: Next,
      ): Promise<void> {
        try {
          const claims = await extractAndVerify(c);
          if (claims) {
            const err = validateClaims(claims, config);
            if (!err) c.set("agentIdentity", claims);
          }
        } catch {
          // Silently ignore
        }
        await next();
      };
    },
  };
}
