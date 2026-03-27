import type { Context, Next } from "koa";
import type { AgentAuthConfig } from "@agent-layer/core";
import { buildOauthDiscoveryDocument, checkRequireAuth } from "@agent-layer/core";

export function agentAuth(config: AgentAuthConfig) {
  const discovery = buildOauthDiscoveryDocument(config);

  return {
    oauthDiscovery(ctx: Context): void {
      ctx.body = discovery;
    },

    requireAuth() {
      return async function requireAuthMiddleware(
        ctx: Context,
        next: Next,
      ): Promise<void> {
        const result = checkRequireAuth(config, ctx.headers.authorization);
        if (result.pass) {
          await next();
          return;
        }
        ctx.set("WWW-Authenticate", result.wwwAuthenticate!);
        ctx.status = 401;
        ctx.body = { error: result.envelope };
      };
    },
  };
}
