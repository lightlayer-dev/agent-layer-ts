/**
 * Hono middleware for agent traffic analytics.
 *
 * Usage:
 *   import { agentAnalytics } from "@agent-layer/hono";
 *   app.use(agentAnalytics({ endpoint: "https://dash.lightlayer.dev/api/agent-events/" }));
 */

import type { Context, MiddlewareHandler, Next } from "hono";
import {
  createAnalytics,
  type AnalyticsConfig,
  type AnalyticsInstance,
  type AgentEvent,
} from "@agent-layer/core";

export type { AnalyticsConfig, AnalyticsInstance, AgentEvent } from "@agent-layer/core";

/**
 * Hono middleware that detects AI agent traffic and collects analytics.
 * Returns the middleware function. Access the analytics instance via
 * `middleware.analytics` for manual flush/shutdown.
 */
export function agentAnalytics(
  config: AnalyticsConfig = {},
): MiddlewareHandler & { analytics: AnalyticsInstance } {
  const instance = createAnalytics(config);

  const middleware: MiddlewareHandler = async (c: Context, next: Next): Promise<void> => {
    const userAgent = c.req.header("user-agent") ?? "";
    const agent = instance.detect(userAgent);

    // Skip non-agent requests unless trackAll is set
    if (!agent && !config.trackAll) {
      await next();
      return;
    }

    const start = Date.now();

    await next();

    const event: AgentEvent = {
      agent: agent ?? "unknown",
      userAgent,
      method: c.req.method,
      path: c.req.path,
      statusCode: c.res.status,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      contentType: c.res.headers.get("content-type") ?? undefined,
      responseSize: Number(c.res.headers.get("content-length")) || undefined,
    };
    instance.record(event);
  };

  (middleware as any).analytics = instance;
  return middleware as MiddlewareHandler & { analytics: AnalyticsInstance };
}
