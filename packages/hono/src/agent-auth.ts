import type { Context, Next } from "hono";
import type { AgentAuthConfig } from "@agent-layer/core";
import { buildOauthDiscoveryDocument, checkRequireAuth } from "@agent-layer/core";

export function agentAuth(config: AgentAuthConfig) {
  const discovery = buildOauthDiscoveryDocument(config);

  return {
    oauthDiscovery(c: Context): Response {
      return c.json(discovery);
    },

    requireAuth() {
      return async function requireAuthMiddleware(
        c: Context,
        next: Next,
      ): Promise<Response | void> {
        const result = checkRequireAuth(config, c.req.header("authorization"));
        if (result.pass) {
          await next();
          return;
        }
        c.header("WWW-Authenticate", result.wwwAuthenticate!);
        return c.json({ error: result.envelope }, 401);
      };
    },
  };
}
