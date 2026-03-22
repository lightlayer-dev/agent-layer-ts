import type { Request, Response, NextFunction } from "express";
import { generateStandaloneAgentsTxt as generateAgentsTxt, isAgentAllowed } from "@agent-layer/core";
import type { AgentsTxtMiddlewareConfig } from "@agent-layer/core";

export type { AgentsTxtMiddlewareConfig };

export function agentsTxtRoutes(config: AgentsTxtMiddlewareConfig) {
  const content = generateAgentsTxt(config);

  return {
    agentsTxt(_req: Request, res: Response): void {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(content);
    },

    enforce() {
      return function enforceAgentsTxt(
        req: Request,
        res: Response,
        next: NextFunction,
      ): void {
        if (!config.enforce) {
          next();
          return;
        }
        const userAgent = req.headers["user-agent"] ?? "";
        const allowed = isAgentAllowed(config, userAgent, req.path);
        if (allowed === false) {
          res.status(403).json({
            error: {
              type: "forbidden_error",
              code: "agent_denied",
              message: `Access denied for agent "${userAgent}" on path "${req.path}". See /agents.txt for access policy.`,
              status: 403,
              is_retriable: false,
              docs_url: "/agents.txt",
            },
          });
          return;
        }
        next();
      };
    },
  };
}
