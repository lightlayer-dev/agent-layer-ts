import type { Context, Next, Middleware } from "koa";
import { generateStandaloneAgentsTxt as generateAgentsTxt, isAgentAllowed } from "@agent-layer/core";
import type { AgentsTxtMiddlewareConfig } from "@agent-layer/core";

export type { AgentsTxtMiddlewareConfig };

export function agentsTxtRoutes(config: AgentsTxtMiddlewareConfig) {
  const content = generateAgentsTxt(config);

  return {
    agentsTxt(ctx: Context): void {
      ctx.set("Content-Type", "text/plain; charset=utf-8");
      ctx.set("Cache-Control", "public, max-age=3600");
      ctx.body = content;
    },

    enforce: (async (ctx: Context, next: Next) => {
      if (!config.enforce) {
        await next();
        return;
      }
      const userAgent = ctx.headers["user-agent"] ?? "";
      const allowed = isAgentAllowed(config, userAgent, ctx.path);
      if (allowed === false) {
        ctx.status = 403;
        ctx.body = {
          error: {
            type: "forbidden_error",
            code: "agent_denied",
            message: `Access denied for agent "${userAgent}" on path "${ctx.path}". See /agents.txt for access policy.`,
            status: 403,
            is_retriable: false,
            docs_url: "/agents.txt",
          },
        };
        return;
      }
      await next();
    }) as Middleware,
  };
}
