import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { generateAgentCard } from "@agent-layer/core";
import type { A2AConfig } from "@agent-layer/core";

/**
 * Fastify plugin that registers the A2A Agent Card endpoint.
 */
export function a2aRoutes(config: A2AConfig) {
  return fp(
    async function a2aPlugin(fastify: FastifyInstance) {
      const card = generateAgentCard(config);

      fastify.get("/.well-known/agent.json", async (_request, reply) => {
        reply.header("Cache-Control", "public, max-age=3600");
        reply.send(card);
      });
    },
    { name: "agent-layer-a2a" },
  );
}
