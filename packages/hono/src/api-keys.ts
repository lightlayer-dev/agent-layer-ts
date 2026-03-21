import type { Context, Next } from "hono";
import { formatError, validateApiKey, hasScope } from "@agent-layer/core";
import type { ApiKeyConfig, ScopedApiKey } from "@agent-layer/core";

/**
 * Hono middleware that extracts and validates an API key from a request header.
 * Attaches the resolved key to `c.set("agentKey", key)` on success.
 */
export function apiKeyAuth(config: ApiKeyConfig) {
  const headerName = config.headerName ?? "X-Agent-Key";
  const headerLower = headerName.toLowerCase();

  return async function apiKeyAuthMiddleware(
    c: Context,
    next: Next,
  ): Promise<Response | void> {
    const rawKey = c.req.header(headerLower);

    if (!rawKey) {
      const envelope = formatError({
        code: "api_key_missing",
        message: `Missing required header: ${headerName}`,
        status: 401,
      });
      return c.json({ error: envelope }, 401);
    }

    const result = await validateApiKey(config.store, rawKey);

    if (!result.valid) {
      const envelope = formatError({
        code: result.error!,
        message:
          result.error === "api_key_expired"
            ? "The API key has expired."
            : "The API key is invalid.",
        status: 401,
      });
      return c.json({ error: envelope }, 401);
    }

    c.set("agentKey", result.key);
    await next();
  };
}

/**
 * Hono middleware that checks if the authenticated API key has the required scope(s).
 * Must be used after `apiKeyAuth()`.
 */
export function requireScope(scope: string | string[]) {
  return async function requireScopeMiddleware(
    c: Context,
    next: Next,
  ): Promise<Response | void> {
    const agentKey = c.get("agentKey") as ScopedApiKey | undefined;

    if (!agentKey) {
      const envelope = formatError({
        code: "api_key_missing",
        message: "Authentication required before scope check.",
        status: 401,
      });
      return c.json({ error: envelope }, 401);
    }

    if (!hasScope(agentKey, scope)) {
      const required = Array.isArray(scope) ? scope.join(", ") : scope;
      const envelope = formatError({
        code: "insufficient_scope",
        message: `Required scope(s): ${required}`,
        status: 403,
      });
      return c.json({ error: envelope }, 403);
    }

    await next();
  };
}
