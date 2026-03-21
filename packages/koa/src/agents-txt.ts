import type { Context, Next } from "koa";
import { generateAgentsTxt, isAgentAllowed } from "@agent-layer/core";
import type { AgentsTxtConfig } from "@agent-layer/core";

export interface AgentsTxtMiddlewareConfig extends AgentsTxtConfig {
  /**
   * When true, enforce the rules as middleware (block denied requests with 403).
   * When false (default), only serve the /agents.txt file without enforcement.
   */
  enforce?: boolean;
}

/**
 * Create Koa handlers for agents.txt — the "robots.txt for AI agents".
 */
export function agentsTxtRoutes(config: AgentsTxtMiddlewareConfig) {
  const content = generateAgentsTxt(config);

  return {
    /**
     * GET /agents.txt handler.
     */
    agentsTxt(ctx: Context): void {
      ctx.set("Content-Type", "text/plain; charset=utf-8");
      ctx.set("Cache-Control", "public, max-age=3600");
      ctx.body = content;
    },

    /**
     * Enforcement middleware.
     */
    async enforce(ctx: Context, next: Next): Promise<void> {
      if (!config.enforce) {
        await next();
        return;
      }

      const userAgent = ctx.get("user-agent") ?? "";
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
    },
  };
}
