import type { Request, Response, NextFunction } from "express";
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
 * Create route handlers and middleware for agent authentication.
 */
export function agentAuth(config: AgentAuthConfig) {
  const realm = config.realm ?? "api";
  const discovery = oauthDiscoveryDocument(config);

  return {
    /**
     * GET /.well-known/oauth-authorization-server handler.
     */
    oauthDiscovery(_req: Request, res: Response): void {
      res.json(discovery);
    },

    /**
     * Middleware that returns structured 401 responses with WWW-Authenticate header.
     * Use this to protect routes that require authentication.
     */
    requireAuth() {
      return function requireAuthMiddleware(
        req: Request,
        res: Response,
        next: NextFunction,
      ): void {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
          const wwwAuth = [`Bearer realm="${realm}"`];
          if (config.scopes) {
            wwwAuth.push(`scope="${Object.keys(config.scopes).join(" ")}"`);
          }
          res.setHeader("WWW-Authenticate", wwwAuth.join(", "));

          const envelope = formatError({
            code: "authentication_required",
            message: "This endpoint requires authentication.",
            status: 401,
            docs_url: config.authorizationUrl,
          });

          res.status(401).json({ error: envelope });
          return;
        }

        next();
      };
    },
  };
}
