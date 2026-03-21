/**
 * Fastify plugin for agent traffic analytics.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  createAnalytics,
  type AnalyticsConfig,
  type AnalyticsInstance,
  type AgentEvent,
} from "@agent-layer/core";

export type { AnalyticsConfig, AnalyticsInstance, AgentEvent } from "@agent-layer/core";

/**
 * Fastify plugin that detects AI agent traffic and collects analytics.
 */
export function agentAnalytics(config: AnalyticsConfig = {}) {
  const instance = createAnalytics(config);

  const plugin = fp(
    async function analyticsPlugin(fastify: FastifyInstance) {
      // Decorate request with start time
      fastify.decorateRequest("_analyticsStart", 0);

      fastify.addHook("onRequest", async (request: FastifyRequest) => {
        (request as any)._analyticsStart = Date.now();
      });

      fastify.addHook(
        "onResponse",
        async (request: FastifyRequest, reply: FastifyReply) => {
          const userAgent = request.headers["user-agent"] ?? "";
          const agent = instance.detect(userAgent);

          if (!agent && !config.trackAll) return;

          const event: AgentEvent = {
            agent: agent ?? "unknown",
            userAgent,
            method: request.method,
            path: request.url,
            statusCode: reply.statusCode,
            durationMs: Date.now() - ((request as any)._analyticsStart || Date.now()),
            timestamp: new Date().toISOString(),
            contentType: reply.getHeader("content-type") as string | undefined,
            responseSize:
              Number(reply.getHeader("content-length")) || undefined,
          };
          instance.record(event);
        },
      );

      // Expose analytics instance
      fastify.decorate("agentAnalytics", instance);
    },
    { name: "agent-layer-analytics" },
  );

  // Also expose analytics on the plugin function for external access
  (plugin as any).analytics = instance;
  return plugin as typeof plugin & { analytics: AnalyticsInstance };
}
