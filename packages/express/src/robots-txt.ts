/**
 * Express middleware: serves /robots.txt with AI agent awareness.
 */
import type { RequestHandler } from "express";
import { generateRobotsTxt } from "@agent-layer/core";
import type { RobotsTxtConfig } from "@agent-layer/core";

export { type RobotsTxtConfig } from "@agent-layer/core";

export interface RobotsTxtHandlers {
  /** GET /robots.txt handler */
  robotsTxt: RequestHandler;
}

/**
 * Create Express route handler for /robots.txt.
 */
export function robotsTxtRoutes(config: RobotsTxtConfig = {}): RobotsTxtHandlers {
  const content = generateRobotsTxt(config);

  return {
    robotsTxt: (_req, res) => {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(content);
    },
  };
}
