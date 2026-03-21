import type { Request, Response, NextFunction } from "express";
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
 * Create Express handlers for agents.txt — the "robots.txt for AI agents".
 *
 * Returns an object with:
 * - `agentsTxt`: route handler for GET /agents.txt
 * - `enforce`: middleware that enforces the declared rules (optional)
 */
export function agentsTxtRoutes(config: AgentsTxtMiddlewareConfig) {
  const content = generateAgentsTxt(config);

  return {
    /**
     * GET /agents.txt handler.
     * Serves the agents.txt file as text/plain.
     */
    agentsTxt(_req: Request, res: Response): void {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(content);
    },

    /**
     * Enforcement middleware.
     * Checks the User-Agent header against the rules and returns 403 if denied.
     * Only active when `enforce: true` is set in config.
     */
    enforce(req: Request, res: Response, next: NextFunction): void {
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
    },
  };
}
