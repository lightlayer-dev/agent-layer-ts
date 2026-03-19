import type { Context, Next } from "koa";
import { formatError, validateApiKey, hasScope } from "@agent-layer/core";
import type { ApiKeyConfig, ScopedApiKey } from "@agent-layer/core";

// Augment Koa state to include agentKey
declare module "koa" {
  interface DefaultState {
    agentKey?: ScopedApiKey;
  }
}

/**
 * Koa middleware that extracts and validates an API key from a request header.
 * Attaches the resolved key to `ctx.state.agentKey` on success.
 */
export function apiKeyAuth(config: ApiKeyConfig) {
  const headerName = config.headerName ?? "X-Agent-Key";
  const headerLower = headerName.toLowerCase();

  return async function apiKeyAuthMiddleware(
    ctx: Context,
    next: Next,
  ): Promise<void> {
    const rawKey = ctx.headers[headerLower] as string | undefined;

    if (!rawKey) {
      const envelope = formatError({
        code: "api_key_missing",
        message: `Missing required header: ${headerName}`,
        status: 401,
      });
      ctx.status = 401;
      ctx.body = { error: envelope };
      return;
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
      ctx.status = 401;
      ctx.body = { error: envelope };
      return;
    }

    ctx.state.agentKey = result.key;
    await next();
  };
}

/**
 * Koa middleware that checks if the authenticated API key has the required scope(s).
 * Must be used after `apiKeyAuth()`.
 */
export function requireScope(scope: string | string[]) {
  return async function requireScopeMiddleware(
    ctx: Context,
    next: Next,
  ): Promise<void> {
    if (!ctx.state.agentKey) {
      const envelope = formatError({
        code: "api_key_missing",
        message: "Authentication required before scope check.",
        status: 401,
      });
      ctx.status = 401;
      ctx.body = { error: envelope };
      return;
    }

    if (!hasScope(ctx.state.agentKey, scope)) {
      const required = Array.isArray(scope) ? scope.join(", ") : scope;
      const envelope = formatError({
        code: "insufficient_scope",
        message: `Required scope(s): ${required}`,
        status: 403,
      });
      ctx.status = 403;
      ctx.body = { error: envelope };
      return;
    }

    await next();
  };
}
