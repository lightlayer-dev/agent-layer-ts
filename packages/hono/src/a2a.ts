import type { Context } from "hono";
import { generateAgentCard } from "@agent-layer/core";
import type { A2AConfig } from "@agent-layer/core";

/**
 * Create Hono route handlers for the A2A Agent Card endpoint.
 */
export function a2aRoutes(config: A2AConfig) {
  const card = generateAgentCard(config);

  return {
    /**
     * GET /.well-known/agent.json handler.
     */
    agentCard(c: Context): Response {
      c.header("Cache-Control", "public, max-age=3600");
      return c.json(card);
    },
  };
}
