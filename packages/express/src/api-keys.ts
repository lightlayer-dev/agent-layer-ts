import type { Request, Response, NextFunction } from "express";
import { formatError, validateApiKey, hasScope } from "@agent-layer/core";
import type { ApiKeyConfig, ScopedApiKey } from "@agent-layer/core";

declare global {
  namespace Express {
    interface Request {
      agentKey?: ScopedApiKey;
    }
  }
}

/**
 * Express middleware that extracts and validates an API key from a request header.
 * Attaches the resolved key to `req.agentKey` on success.
 */
export function apiKeyAuth(config: ApiKeyConfig) {
  const headerName = config.headerName ?? "X-Agent-Key";
  const headerLower = headerName.toLowerCase();

  return async function apiKeyAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const rawKey = req.headers[headerLower] as string | undefined;

      if (!rawKey) {
        const envelope = formatError({
          code: "api_key_missing",
          message: `Missing required header: ${headerName}`,
          status: 401,
        });
        res.status(401).json({ error: envelope });
        return;
      }

      const result = await validateApiKey(config.store, rawKey);

      if (!result.valid) {
        const status = result.error === "api_key_expired" ? 401 : 401;
        const envelope = formatError({
          code: result.error!,
          message:
            result.error === "api_key_expired"
              ? "The API key has expired."
              : "The API key is invalid.",
          status,
        });
        res.status(status).json({ error: envelope });
        return;
      }

      req.agentKey = result.key;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Express middleware that checks if the authenticated API key has the required scope(s).
 * Must be used after `apiKeyAuth()`.
 */
export function requireScope(scope: string | string[]) {
  return function requireScopeMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (!req.agentKey) {
      const envelope = formatError({
        code: "api_key_missing",
        message: "Authentication required before scope check.",
        status: 401,
      });
      res.status(401).json({ error: envelope });
      return;
    }

    if (!hasScope(req.agentKey, scope)) {
      const required = Array.isArray(scope) ? scope.join(", ") : scope;
      const envelope = formatError({
        code: "insufficient_scope",
        message: `Required scope(s): ${required}`,
        status: 403,
      });
      res.status(403).json({ error: envelope });
      return;
    }

    next();
  };
}
