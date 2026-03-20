import type { Request, Response } from "express";
import { generateAgentCard } from "@agent-layer/core";
import type { A2AConfig } from "@agent-layer/core";

/**
 * Create Express route handlers for the A2A Agent Card endpoint.
 *
 * Serves the agent card at /.well-known/agent.json per the A2A protocol spec.
 */
export function a2aRoutes(config: A2AConfig) {
  const card = generateAgentCard(config);

  return {
    /**
     * GET /.well-known/agent.json handler.
     *
     * Returns the A2A Agent Card JSON document for agent discovery.
     */
    agentCard(_req: Request, res: Response): void {
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.json(card);
    },
  };
}
