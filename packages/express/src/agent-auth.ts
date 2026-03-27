import type { Request, Response, NextFunction } from "express";
import type { AgentAuthConfig } from "@agent-layer/core";
import { buildOauthDiscoveryDocument, checkRequireAuth } from "@agent-layer/core";

export function agentAuth(config: AgentAuthConfig) {
  const discovery = buildOauthDiscoveryDocument(config);

  return {
    oauthDiscovery(_req: Request, res: Response): void {
      res.json(discovery);
    },

    requireAuth() {
      return function requireAuthMiddleware(
        req: Request,
        res: Response,
        next: NextFunction,
      ): void {
        const result = checkRequireAuth(config, req.headers.authorization);
        if (result.pass) {
          next();
          return;
        }
        res.setHeader("WWW-Authenticate", result.wwwAuthenticate!);
        res.status(401).json({ error: result.envelope });
      };
    },
  };
}
