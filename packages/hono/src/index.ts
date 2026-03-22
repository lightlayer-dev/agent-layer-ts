import { Hono } from "hono";
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
import { agentsTxtRoutes } from "./agents-txt.js";

export { agentErrors, notFoundHandler } from "./agent-errors.js";
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
export { agUiStream } from "./ag-ui.js";
export type { AgUiStreamHandler, AgUiMiddlewareOptions } from "./ag-ui.js";

/**
 * One-liner that composes all agent-layer middleware onto a single Hono app.
 * Each feature can be disabled by setting it to `false` in the config.
 */
export function agentLayer(config: AgentLayerConfig): Hono {
  const app = new Hono();

  // Error handling
  if (config.errors !== false) {
    app.onError(agentErrors());
  }

  // Analytics (earliest — captures all agent traffic)
  if (config.analytics !== false && config.analytics) {
    app.use("*", agentAnalytics(config.analytics));
  }

  // API key auth (early — before rate limiting)
  if (config.apiKeys !== false && config.apiKeys) {
    app.use("*", apiKeyAuth(config.apiKeys));
  }

  // Rate limiting (early — before routes)
  if (config.rateLimit !== false && config.rateLimit) {
    app.use("*", rateLimits(config.rateLimit));
  }

  // Agent meta (HTML transforms)
  if (config.agentMeta !== false && config.agentMeta) {
    app.use("*", agentMeta(config.agentMeta));
  }

  // LLMs.txt routes
  if (config.llmsTxt !== false && config.llmsTxt) {
    const handlers = llmsTxtRoutes(config.llmsTxt);
    app.get("/llms.txt", (c) => handlers.llmsTxt(c));
    app.get("/llms-full.txt", (c) => handlers.llmsFullTxt(c));
  }

  // Discovery routes
  if (config.discovery !== false && config.discovery) {
    const handlers = discoveryRoutes(config.discovery);
    app.get("/.well-known/ai", (c) => handlers.wellKnownAi(c));
    app.get("/openapi.json", (c) => handlers.openApiJson(c));
  }

  // A2A Agent Card (/.well-known/agent.json)
  if (config.a2a !== false && config.a2a) {
    const handlers = a2aRoutes(config.a2a);
    app.get("/.well-known/agent.json", (c) => handlers.agentCard(c));
  }

  // agents.txt (robots.txt for AI agents)
  if (config.agentsTxt !== false && config.agentsTxt) {
    const handlers = agentsTxtRoutes(config.agentsTxt);
    app.get("/agents.txt", (c) => handlers.agentsTxt(c));
    if (config.agentsTxt.enforce) {
      app.use("*", handlers.enforce);
    }
  }

  // Auth discovery
  if (config.agentAuth !== false && config.agentAuth) {
    const handlers = agentAuth(config.agentAuth);
    app.get("/.well-known/oauth-authorization-server", (c) =>
      handlers.oauthDiscovery(c),
    );
  }

  // 404 handler (after all routes)
  if (config.errors !== false) {
    app.notFound(notFoundHandler());
  }

  return app;
}
