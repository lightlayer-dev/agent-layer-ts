import type { Context, Next, MiddlewareHandler } from "hono";
import { generateStandaloneAgentsTxt as generateAgentsTxt, isAgentAllowed } from "@agent-layer/core";
import type { AgentsTxtMiddlewareConfig } from "@agent-layer/core";

export type { AgentsTxtMiddlewareConfig };

export function agentsTxtRoutes(config: AgentsTxtMiddlewareConfig) {
  const content = generateAgentsTxt(config);

  return {
    agentsTxt(c: Context): Response {
      c.header("Content-Type", "text/plain; charset=utf-8");
      c.header("Cache-Control", "public, max-age=3600");
      return c.text(content);
    },

    enforce: ((c: Context, next: Next) => {
      if (!config.enforce) {
        return next();
      }

      const userAgent = c.req.header("user-agent") ?? "";
      const allowed = isAgentAllowed(config, userAgent, c.req.path);

      if (allowed === false) {
        return c.json(
          {
            error: {
              type: "forbidden_error",
              code: "agent_denied",
              message: `Access denied for agent "${userAgent}" on path "${c.req.path}". See /agents.txt for access policy.`,
              status: 403,
              is_retriable: false,
              docs_url: "/agents.txt",
            },
          },
          403,
        );
      }

      return next();
    }) as MiddlewareHandler,
  };
}
