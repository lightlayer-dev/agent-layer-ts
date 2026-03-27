import type { Context, Next } from "hono";
import type { AgentIdentityConfig, AgentIdentityClaims } from "@agent-layer/core";
import { handleRequireIdentity, handleOptionalIdentity } from "@agent-layer/core";

export function agentIdentity(config: AgentIdentityConfig) {
  const headerName = (config.headerName ?? "authorization").toLowerCase();

  return {
    requireIdentity() {
      return async function requireIdentityMiddleware(
        c: Context,
        next: Next,
      ): Promise<Response | void> {
        const rawHeader = c.req.header(headerName);
        const headers: Record<string, string | undefined> = {};
        c.req.raw.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const result = await handleRequireIdentity(rawHeader, config, {
          method: c.req.method,
          path: c.req.path,
          headers,
        });

        if ("error" in result) {
          return c.json({ error: result.error.envelope }, result.error.status as any);
        }

        c.set("agentIdentity", result.claims);
        await next();
      };
    },

    optionalIdentity() {
      return async function optionalIdentityMiddleware(
        c: Context,
        next: Next,
      ): Promise<void> {
        const rawHeader = c.req.header(headerName);
        const claims = await handleOptionalIdentity(rawHeader, config);
        if (claims) c.set("agentIdentity", claims);
        await next();
      };
    },
  };
}
