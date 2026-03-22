import type { Context, Next } from "koa";
import type { AgentIdentityConfig, AgentIdentityClaims } from "@agent-layer/core";
import { handleRequireIdentity, handleOptionalIdentity } from "@agent-layer/core";

declare module "koa" {
  interface DefaultState {
    agentIdentity?: AgentIdentityClaims;
  }
}

export function agentIdentity(config: AgentIdentityConfig) {
  const headerName = (config.headerName ?? "authorization").toLowerCase();

  return {
    requireIdentity() {
      return async function requireIdentityMiddleware(
        ctx: Context,
        next: Next,
      ): Promise<void> {
        const rawHeader = ctx.get(headerName);
        const result = await handleRequireIdentity(rawHeader || undefined, config, {
          method: ctx.method,
          path: ctx.path,
          headers: ctx.headers as Record<string, string | undefined>,
        });

        if ("error" in result) {
          ctx.status = result.error.status;
          ctx.body = { error: result.error.envelope };
          return;
        }

        ctx.state.agentIdentity = result.claims;
        await next();
      };
    },

    optionalIdentity() {
      return async function optionalIdentityMiddleware(
        ctx: Context,
        next: Next,
      ): Promise<void> {
        const rawHeader = ctx.get(headerName);
        const claims = await handleOptionalIdentity(rawHeader || undefined, config);
        if (claims) ctx.state.agentIdentity = claims;
        await next();
      };
    },
  };
}
