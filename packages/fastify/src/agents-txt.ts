import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { generateAgentsTxt, isAgentAllowed } from "@agent-layer/core";
import type { AgentsTxtConfig } from "@agent-layer/core";

export interface AgentsTxtMiddlewareConfig extends AgentsTxtConfig {
  enforce?: boolean;
}

/**
 * Fastify plugin that registers agents.txt — the "robots.txt for AI agents".
 */
export function agentsTxtRoutes(config: AgentsTxtMiddlewareConfig) {
  const content = generateAgentsTxt(config);

  return fp(
    async function agentsTxtPlugin(fastify: FastifyInstance) {
      // Serve /agents.txt
      fastify.get("/agents.txt", async (_request: FastifyRequest, reply: FastifyReply) => {
        reply.header("Content-Type", "text/plain; charset=utf-8");
        reply.header("Cache-Control", "public, max-age=3600");
        reply.send(content);
      });

      // Enforcement hook
      if (config.enforce) {
        fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
          const userAgent = request.headers["user-agent"] ?? "";
          const allowed = isAgentAllowed(config, userAgent, request.url);

          if (allowed === false) {
            reply.status(403).send({
              error: {
                type: "forbidden_error",
                code: "agent_denied",
                message: `Access denied for agent "${userAgent}" on path "${request.url}". See /agents.txt for access policy.`,
                status: 403,
                is_retriable: false,
                docs_url: "/agents.txt",
              },
            });
          }
        });
      }
    },
    { name: "agent-layer-agents-txt" },
  );
}
