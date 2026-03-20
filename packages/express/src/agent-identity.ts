import type { Request, Response, NextFunction } from "express";
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
  buildAuditEvent,
  formatError,
} from "@agent-layer/core";

declare global {
  namespace Express {
    interface Request {
      agentIdentity?: AgentIdentityClaims;
    }
  }
}

/**
 * Express middleware for agent identity verification and authorization.
 *
 * Extracts and validates agent identity tokens from request headers,
 * evaluates authorization policies, and attaches verified claims to req.agentIdentity.
 *
 * Per IETF draft-klrc-aiagent-auth-00:
 * - Validates JWT-based Workload Identity Tokens
 * - Enforces short-lived credential requirements
 * - Supports SPIFFE trust domain validation
 * - Generates audit events for observability
 */
export function agentIdentity(config: AgentIdentityConfig) {
  const headerName = (config.headerName ?? "authorization").toLowerCase();
  const prefix = config.tokenPrefix ?? "Bearer";

  return {
    /**
     * Middleware that verifies agent identity and evaluates authorization.
     * Rejects requests with invalid/missing tokens with structured 401/403 responses.
     */
    requireIdentity() {
      return async function requireIdentityMiddleware(
        req: Request,
        res: Response,
        next: NextFunction,
      ): Promise<void> {
        // Extract token
        const headerValue = req.headers[headerName];
        const rawHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;

        if (!rawHeader) {
          res.status(401).json({
            error: formatError({
              code: "agent_identity_required",
              message: "Agent identity token is required.",
              status: 401,
            }),
          });
          return;
        }

        const token = rawHeader.startsWith(prefix + " ")
          ? rawHeader.slice(prefix.length + 1)
          : rawHeader;

        // Verify token
        let claims: AgentIdentityClaims;

        if (config.verifyToken) {
          const result = await config.verifyToken(token);
          if (!result) {
            res.status(401).json({
              error: formatError({
                code: "verification_failed",
                message: "Agent identity token verification failed.",
                status: 401,
              }),
            });
            return;
          }
          claims = result;
        } else {
          // Decode without cryptographic verification (for development/testing)
          // In production, provide a verifyToken function with proper JWKS validation
          const payload = decodeJwtClaims(token);
          if (!payload) {
            res.status(401).json({
              error: formatError({
                code: "malformed_token",
                message: "Agent identity token is malformed.",
                status: 401,
              }),
            });
            return;
          }
          claims = extractClaims(payload);
        }

        // Validate claims
        const validationError = validateClaims(claims, config);
        if (validationError) {
          const status = validationError.code === "expired_token" ? 401 : 403;
          res.status(status).json({
            error: formatError({
              code: validationError.code,
              message: validationError.message,
              status,
            }),
          });
          return;
        }

        // Attach to request
        req.agentIdentity = claims;

        // Evaluate authorization if policies are configured
        if (config.policies && config.policies.length > 0) {
          const context: AuthzContext = {
            method: req.method,
            path: req.path,
            headers: req.headers as Record<string, string | undefined>,
          };

          const authzResult = evaluateAuthz(
            claims,
            context,
            config.policies,
            config.defaultPolicy,
          );

          if (!authzResult.allowed) {
            res.status(403).json({
              error: formatError({
                code: "agent_unauthorized",
                message: authzResult.deniedReason ?? "Agent is not authorized.",
                status: 403,
              }),
            });
            return;
          }
        }

        next();
      };
    },

    /**
     * Optional middleware that extracts identity if present but doesn't require it.
     * Useful for routes that behave differently for identified vs anonymous agents.
     */
    optionalIdentity() {
      return async function optionalIdentityMiddleware(
        req: Request,
        _res: Response,
        next: NextFunction,
      ): Promise<void> {
        const headerValue = req.headers[headerName];
        const rawHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;

        if (!rawHeader) {
          next();
          return;
        }

        const token = rawHeader.startsWith(prefix + " ")
          ? rawHeader.slice(prefix.length + 1)
          : rawHeader;

        try {
          let claims: AgentIdentityClaims;
          if (config.verifyToken) {
            const result = await config.verifyToken(token);
            if (result) claims = result;
            else { next(); return; }
          } else {
            const payload = decodeJwtClaims(token);
            if (!payload) { next(); return; }
            claims = extractClaims(payload);
          }

          const err = validateClaims(claims, config);
          if (!err) req.agentIdentity = claims;
        } catch {
          // Silently ignore — identity is optional
        }

        next();
      };
    },
  };
}
