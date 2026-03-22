import type { Request, Response, NextFunction } from "express";
import type { AgentIdentityConfig, AgentIdentityClaims } from "@agent-layer/core";
import { handleRequireIdentity, handleOptionalIdentity } from "@agent-layer/core";

declare global {
  namespace Express {
    interface Request {
      agentIdentity?: AgentIdentityClaims;
    }
  }
}

export function agentIdentity(config: AgentIdentityConfig) {
  const headerName = (config.headerName ?? "authorization").toLowerCase();

  return {
    requireIdentity() {
      return async function requireIdentityMiddleware(
        req: Request,
        res: Response,
        next: NextFunction,
      ): Promise<void> {
        const headerValue = req.headers[headerName];
        const rawHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;

        const result = await handleRequireIdentity(rawHeader, config, {
          method: req.method,
          path: req.path,
          headers: req.headers as Record<string, string | undefined>,
        });

        if ("error" in result) {
          res.status(result.error.status).json({ error: result.error.envelope });
          return;
        }

        req.agentIdentity = result.claims;
        next();
      };
    },

    optionalIdentity() {
      return async function optionalIdentityMiddleware(
        req: Request,
        _res: Response,
        next: NextFunction,
      ): Promise<void> {
        const headerValue = req.headers[headerName];
        const rawHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        const claims = await handleOptionalIdentity(rawHeader, config);
        if (claims) req.agentIdentity = claims;
        next();
      };
    },
  };
}
