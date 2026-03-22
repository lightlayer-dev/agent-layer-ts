import type { FastifyInstance } from "fastify";
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

export function unifiedDiscovery(config: UnifiedDiscoveryConfig) {
  const aiManifest = generateUnifiedAIManifest(config);
  const agentCardDoc = generateUnifiedAgentCard(config);
  const agentsTxtDoc = generateAgentsTxt(config);
  const llmsTxtDoc = generateUnifiedLlmsTxt(config);
  const llmsFullTxtDoc = generateUnifiedLlmsFullTxt(config);

  return fp(
    async function unifiedDiscoveryPlugin(fastify: FastifyInstance) {
      if (isFormatEnabled(config.formats, "wellKnownAi")) {
        fastify.get("/.well-known/ai", async (_request, reply) => {
          reply.send(aiManifest);
        });
      }
      if (isFormatEnabled(config.formats, "agentCard")) {
        fastify.get("/.well-known/agent.json", async (_request, reply) => {
          reply.send(agentCardDoc);
        });
      }
      if (isFormatEnabled(config.formats, "agentsTxt")) {
        fastify.get("/agents.txt", async (_request, reply) => {
          reply.type("text/plain").send(agentsTxtDoc);
        });
      }
      if (isFormatEnabled(config.formats, "llmsTxt")) {
        fastify.get("/llms.txt", async (_request, reply) => {
          reply.type("text/plain").send(llmsTxtDoc);
        });
        fastify.get("/llms-full.txt", async (_request, reply) => {
          reply.type("text/plain").send(llmsFullTxtDoc);
        });
      }
    },
    { name: "agent-layer-unified-discovery" },
  );
}
