/**
 * Express middleware for agent traffic analytics.
 *
 * Usage:
 *   import { agentAnalytics } from "@agent-layer/express";
 *   app.use(agentAnalytics({ endpoint: "https://dash.lightlayer.dev/api/agent-events/" }));
 */

import type { Request, Response, NextFunction } from "express";
import {
  createAnalytics,
  type AnalyticsConfig,
  type AnalyticsInstance,
  type AgentEvent,
} from "@agent-layer/core";

export type { AnalyticsConfig, AnalyticsInstance, AgentEvent } from "@agent-layer/core";

/**
 * Express middleware that detects AI agent traffic and collects analytics.
 * Returns the middleware function. Access the analytics instance via
 * `middleware.analytics` for manual flush/shutdown.
 */
export function agentAnalytics(
  config: AnalyticsConfig = {},
): ((req: Request, res: Response, next: NextFunction) => void) & {
  analytics: AnalyticsInstance;
} {
  const instance = createAnalytics(config);

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    const userAgent = req.get("user-agent") ?? "";
    const agent = instance.detect(userAgent);

    // Skip non-agent requests unless trackAll is set
    if (!agent && !config.trackAll) {
      next();
      return;
    }

    const start = Date.now();

    // Hook into response finish to capture status and timing
    res.on("finish", () => {
      const event: AgentEvent = {
        agent: agent ?? "unknown",
        userAgent,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        contentType: res.get("content-type"),
        responseSize: Number(res.get("content-length")) || undefined,
      };
      instance.record(event);
    });

    next();
  };

  middleware.analytics = instance;
  return middleware;
}
