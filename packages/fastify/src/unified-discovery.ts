/**
 * Fastify plugin for unified multi-format agent discovery.
 *
 * Serves all enabled discovery formats from a single configuration:
 * - /.well-known/ai       → JSON (AI manifest)
 * - /.well-known/agent.json → JSON (A2A Agent Card)
 * - /agents.txt           → text/plain
 * - /llms.txt             → text/plain
 * - /llms-full.txt        → text/plain
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import type { UnifiedDiscoveryConfig } from "@agent-layer/core";
import {
  generateUnifiedAIManifest,
  generateUnifiedAgentCard,
  generateUnifiedLlmsTxt,
  generateUnifiedLlmsFullTxt,
  generateAgentsTxt,
  isFormatEnabled,
} from "@agent-layer/core";

/**
 * Create unified discovery Fastify plugin from a single config.
 *
 * @example
 * ```ts
 * import { unifiedDiscovery } from '@agent-layer/fastify';
 *
 * fastify.register(unifiedDiscovery({
 *   name: 'My API',
 *   description: 'REST API for widgets',
 *   url: 'https://api.example.com',
 *   skills: [{ id: 'search', name: 'Search', description: 'Full-text search' }],
 * }));
 * ```
 */
export function unifiedDiscovery(config: UnifiedDiscoveryConfig) {
  // Pre-generate all documents (they don't change at runtime)
  const aiManifest = generateUnifiedAIManifest(config);
  const agentCardDoc = generateUnifiedAgentCard(config);
  const agentsTxtDoc = generateAgentsTxt(config);
  const llmsTxtDoc = generateUnifiedLlmsTxt(config);
  const llmsFullTxtDoc = generateUnifiedLlmsFullTxt(config);

  return fp(
    async function unifiedDiscoveryPlugin(fastify: FastifyInstance) {
      if (isFormatEnabled(config.formats, "wellKnownAi")) {
        fastify.get("/.well-known/ai", async (_request: FastifyRequest, reply: FastifyReply) => {
          reply.send(aiManifest);
        });
      }

      if (isFormatEnabled(config.formats, "agentCard")) {
        fastify.get("/.well-known/agent.json", async (_request: FastifyRequest, reply: FastifyReply) => {
          reply.send(agentCardDoc);
        });
      }

      if (isFormatEnabled(config.formats, "agentsTxt")) {
        fastify.get("/agents.txt", async (_request: FastifyRequest, reply: FastifyReply) => {
          reply.header("Content-Type", "text/plain; charset=utf-8");
          reply.send(agentsTxtDoc);
        });
      }

      if (isFormatEnabled(config.formats, "llmsTxt")) {
        fastify.get("/llms.txt", async (_request: FastifyRequest, reply: FastifyReply) => {
          reply.header("Content-Type", "text/plain; charset=utf-8");
          reply.send(llmsTxtDoc);
        });

        fastify.get("/llms-full.txt", async (_request: FastifyRequest, reply: FastifyReply) => {
          reply.header("Content-Type", "text/plain; charset=utf-8");
          reply.send(llmsFullTxtDoc);
        });
      }
    },
    { name: "agent-layer-unified-discovery" },
  );
}
