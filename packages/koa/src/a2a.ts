import type { Context } from "koa";
import { generateAgentCard } from "@agent-layer/core";
import type { A2AConfig } from "@agent-layer/core";

/**
 * Create Koa route handlers for the A2A Agent Card endpoint.
 */
export function a2aRoutes(config: A2AConfig) {
  const card = generateAgentCard(config);

  return {
    /**
     * GET /.well-known/agent.json handler.
     */
    agentCard(ctx: Context): void {
      ctx.set("Cache-Control", "public, max-age=3600");
      ctx.body = card;
    },
  };
}
