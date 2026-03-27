import type { Request, Response } from "express";
import { generateLlmsTxt, generateLlmsFullTxt } from "@agent-layer/core";
import type { LlmsTxtConfig, RouteMetadata } from "@agent-layer/core";

/**
 * Create Express route handlers for GET /llms.txt and /llms-full.txt.
 */
export function llmsTxtRoutes(config: LlmsTxtConfig, routes: RouteMetadata[] = []) {
  const txt = generateLlmsTxt(config);
  const fullTxt = generateLlmsFullTxt(config, routes);

  return {
    /**
     * GET /llms.txt handler — returns the concise version.
     */
    llmsTxt(_req: Request, res: Response): void {
      res.type("text/plain").send(txt);
    },

    /**
     * GET /llms-full.txt handler — returns the full version with route docs.
     */
    llmsFullTxt(_req: Request, res: Response): void {
      res.type("text/plain").send(fullTxt);
    },
  };
}
