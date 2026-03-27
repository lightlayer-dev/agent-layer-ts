/**
 * Koa middleware: serves /robots.txt with AI agent awareness.
 */
import type { Context } from "koa";
import { generateRobotsTxt } from "@agent-layer/core";
import type { RobotsTxtConfig } from "@agent-layer/core";

export { type RobotsTxtConfig } from "@agent-layer/core";

export interface RobotsTxtHandlers {
  /** GET /robots.txt handler */
  robotsTxt(ctx: Context): void;
}

/**
 * Create Koa route handler for /robots.txt.
 */
export function robotsTxtRoutes(config: RobotsTxtConfig = {}): RobotsTxtHandlers {
  const content = generateRobotsTxt(config);

  return {
    robotsTxt(ctx: Context): void {
      ctx.set("Content-Type", "text/plain; charset=utf-8");
      ctx.set("Cache-Control", "public, max-age=86400");
      ctx.body = content;
    },
  };
}
