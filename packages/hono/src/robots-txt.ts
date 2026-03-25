/**
 * Hono middleware: serves /robots.txt with AI agent awareness.
 */
import type { Context } from "hono";
import { generateRobotsTxt } from "@agent-layer/core";
import type { RobotsTxtConfig } from "@agent-layer/core";

export { type RobotsTxtConfig } from "@agent-layer/core";

export interface RobotsTxtHandlers {
  /** GET /robots.txt handler */
  robotsTxt(c: Context): Response;
}

/**
 * Create Hono route handler for /robots.txt.
 */
export function robotsTxtRoutes(config: RobotsTxtConfig = {}): RobotsTxtHandlers {
  const content = generateRobotsTxt(config);

  return {
    robotsTxt(c: Context): Response {
      c.header("Content-Type", "text/plain; charset=utf-8");
      c.header("Cache-Control", "public, max-age=86400");
      return c.text(content);
    },
  };
}
