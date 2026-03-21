import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { generateLlmsTxt, generateLlmsFullTxt } from "@agent-layer/core";
import type { LlmsTxtConfig, RouteMetadata } from "@agent-layer/core";

/**
 * Fastify plugin that registers GET /llms.txt and /llms-full.txt routes.
 */
export function llmsTxtRoutes(config: LlmsTxtConfig, routes: RouteMetadata[] = []) {
  return fp(
    async function llmsTxtPlugin(fastify: FastifyInstance) {
      const txt = generateLlmsTxt(config);
      const fullTxt = generateLlmsFullTxt(config, routes);

      fastify.get("/llms.txt", async (_request, reply) => {
        reply.header("Cache-Control", "public, max-age=3600").type("text/plain").send(txt);
      });

      fastify.get("/llms-full.txt", async (_request, reply) => {
        reply.header("Cache-Control", "public, max-age=3600").type("text/plain").send(fullTxt);
      });
    },
    { name: "agent-layer-llms-txt" },
  );
}
