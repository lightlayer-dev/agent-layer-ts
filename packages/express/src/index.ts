import type { Router } from "express";
import { Router as createRouter } from "express";
import type { AgentLayerConfig } from "@agent-layer/core";
import { agentErrors, notFoundHandler } from "./agent-errors.js";
import { rateLimits } from "./rate-limits.js";
import { llmsTxtRoutes } from "./llms-txt.js";
import { discoveryRoutes } from "./discovery.js";
import { agentMeta } from "./agent-meta.js";
import { agentAuth } from "./agent-auth.js";
import { agentAnalytics } from "./analytics.js";
import { apiKeyAuth } from "./api-keys.js";
import { a2aRoutes } from "./a2a.js";

export { agentErrors, notFoundHandler } from "./agent-errors.js";
export { rateLimits } from "./rate-limits.js";
export { llmsTxtRoutes } from "./llms-txt.js";
export { discoveryRoutes } from "./discovery.js";
export { agentMeta } from "./agent-meta.js";
export { agentAuth } from "./agent-auth.js";
export { agentAnalytics } from "./analytics.js";
export type { AnalyticsConfig, AnalyticsInstance, AgentEvent } from "./analytics.js";
export { apiKeyAuth, requireScope } from "./api-keys.js";
export { a2aRoutes } from "./a2a.js";

/**
 * One-liner that composes all agent-layer middleware onto a single Express router.
 * Each feature can be disabled by setting it to `false` in the config.
 */
export function agentLayer(config: AgentLayerConfig): Router {
  const router = createRouter();

  // Analytics (earliest — captures all agent traffic)
  if (config.analytics !== false && config.analytics) {
    router.use(agentAnalytics(config.analytics));
  }

  // API key auth (early — before rate limiting)
  if (config.apiKeys !== false && config.apiKeys) {
    router.use(apiKeyAuth(config.apiKeys));
  }

  // Rate limiting (early — before routes)
  if (config.rateLimit !== false && config.rateLimit) {
    router.use(rateLimits(config.rateLimit));
  }

  // Agent meta (HTML transforms)
  if (config.agentMeta !== false && config.agentMeta) {
    router.use(agentMeta(config.agentMeta));
  }

  // LLMs.txt routes
  if (config.llmsTxt !== false && config.llmsTxt) {
    const handlers = llmsTxtRoutes(config.llmsTxt);
    router.get("/llms.txt", handlers.llmsTxt);
    router.get("/llms-full.txt", handlers.llmsFullTxt);
  }

  // Discovery routes
  if (config.discovery !== false && config.discovery) {
    const handlers = discoveryRoutes(config.discovery);
    router.get("/.well-known/ai", handlers.wellKnownAi);
    router.get("/openapi.json", handlers.openApiJson);
  }

  // A2A Agent Card (/.well-known/agent.json)
  if (config.a2a !== false && config.a2a) {
    const handlers = a2aRoutes(config.a2a);
    router.get("/.well-known/agent.json", handlers.agentCard);
  }

  // Auth discovery
  if (config.agentAuth !== false && config.agentAuth) {
    const handlers = agentAuth(config.agentAuth);
    router.get("/.well-known/oauth-authorization-server", handlers.oauthDiscovery);
  }

  // Error handling (late — after routes)
  if (config.errors !== false) {
    router.use(notFoundHandler());
    router.use(agentErrors());
  }

  return router;
}
