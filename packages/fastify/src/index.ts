import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { AgentLayerConfig } from "@agent-layer/core";
import { agentErrors } from "./agent-errors.js";
import { rateLimits } from "./rate-limits.js";
import { llmsTxtRoutes } from "./llms-txt.js";
import { discoveryRoutes } from "./discovery.js";
import { agentMeta } from "./agent-meta.js";
import { agentAuth } from "./agent-auth.js";
import { agentAnalytics } from "./analytics.js";
import { apiKeyAuth } from "./api-keys.js";
import { a2aRoutes } from "./a2a.js";
import { agentsTxtRoutes } from "./agents-txt.js";

export { agentErrors } from "./agent-errors.js";
export { rateLimits } from "./rate-limits.js";
export { llmsTxtRoutes } from "./llms-txt.js";
export { discoveryRoutes } from "./discovery.js";
export { agentMeta } from "./agent-meta.js";
export { agentAuth } from "./agent-auth.js";
export { agentAnalytics } from "./analytics.js";
export type { AnalyticsConfig, AnalyticsInstance, AgentEvent } from "./analytics.js";
export { apiKeyAuth, requireScope } from "./api-keys.js";
export { x402Payment } from "./x402.js";
export type { X402Config, X402RouteConfig } from "./x402.js";
export { a2aRoutes } from "./a2a.js";
export { agentIdentity } from "./agent-identity.js";
export { agentsTxtRoutes } from "./agents-txt.js";
export type { AgentsTxtMiddlewareConfig } from "./agents-txt.js";
export { mcpServer } from "./mcp.js";
export type { McpServerConfig } from "./mcp.js";
export { unifiedDiscovery } from "./unified-discovery.js";

/**
 * One-liner Fastify plugin that composes all agent-layer functionality.
 * Each feature can be disabled by setting it to `false` in the config.
 */
export function agentLayer(config: AgentLayerConfig) {
  return fp(
    async function agentLayerPlugin(fastify: FastifyInstance) {
      // Error handling
      if (config.errors !== false) {
        await fastify.register(agentErrors);
      }

      // Analytics (earliest — captures all agent traffic)
      if (config.analytics !== false && config.analytics) {
        await fastify.register(agentAnalytics(config.analytics));
      }

      // API key auth (early — before rate limiting)
      if (config.apiKeys !== false && config.apiKeys) {
        await fastify.register(apiKeyAuth(config.apiKeys));
      }

      // Rate limiting (early — before routes)
      if (config.rateLimit !== false && config.rateLimit) {
        await fastify.register(rateLimits(config.rateLimit));
      }

      // Agent meta (HTML transforms)
      if (config.agentMeta !== false && config.agentMeta) {
        await fastify.register(agentMeta(config.agentMeta));
      }

      // LLMs.txt routes
      if (config.llmsTxt !== false && config.llmsTxt) {
        await fastify.register(llmsTxtRoutes(config.llmsTxt));
      }

      // Discovery routes
      if (config.discovery !== false && config.discovery) {
        await fastify.register(discoveryRoutes(config.discovery));
      }

      // A2A Agent Card (/.well-known/agent.json)
      if (config.a2a !== false && config.a2a) {
        await fastify.register(a2aRoutes(config.a2a));
      }

      // agents.txt (robots.txt for AI agents)
      if (config.agentsTxt !== false && config.agentsTxt) {
        await fastify.register(agentsTxtRoutes(config.agentsTxt));
      }

      // Auth discovery
      if (config.agentAuth !== false && config.agentAuth) {
        const auth = agentAuth(config.agentAuth);
        await fastify.register(auth.discoveryPlugin);
      }
    },
    { name: "agent-layer" },
  );
}
