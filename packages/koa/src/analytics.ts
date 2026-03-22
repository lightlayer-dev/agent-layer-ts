import type { Context, Next } from "koa";
import {
  createAnalytics,
  type AnalyticsConfig,
  type AnalyticsInstance,
  type AgentEvent,
} from "@agent-layer/core";

export type { AnalyticsConfig, AnalyticsInstance, AgentEvent } from "@agent-layer/core";

export function agentAnalytics(
  config: AnalyticsConfig = {},
) {
  const instance = createAnalytics(config);

  const middleware = async (ctx: Context, next: Next): Promise<void> => {
    const userAgent = ctx.get("user-agent") ?? "";
    const agent = instance.detect(userAgent);

    if (!agent && !config.trackAll) {
      await next();
      return;
    }

    const start = Date.now();
    await next();

    const event: AgentEvent = {
      agent: agent ?? "unknown",
      userAgent,
      method: ctx.method,
      path: ctx.originalUrl || ctx.url,
      statusCode: ctx.status,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      contentType: ctx.response.get("content-type") || undefined,
      responseSize: Number(ctx.response.get("content-length")) || undefined,
    };
    instance.record(event);
  };

  (middleware as any).analytics = instance;
  return middleware as typeof middleware & { analytics: AnalyticsInstance };
}
