/**
 * Fastify plugin: serves /robots.txt with AI agent awareness.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { generateRobotsTxt } from "@agent-layer/core";
import type { RobotsTxtConfig } from "@agent-layer/core";

export { type RobotsTxtConfig } from "@agent-layer/core";

/**
 * Create Fastify plugin that registers GET /robots.txt.
 */
export function robotsTxtRoutes(config: RobotsTxtConfig = {}) {
  const content = generateRobotsTxt(config);

  return fp(
    async function robotsTxtPlugin(fastify: FastifyInstance) {
      fastify.get("/robots.txt", async (_request: FastifyRequest, reply: FastifyReply) => {
        reply.header("Content-Type", "text/plain; charset=utf-8");
        reply.header("Cache-Control", "public, max-age=86400");
        reply.send(content);
      });
    },
    { name: "agent-layer-robots-txt" },
  );
}
