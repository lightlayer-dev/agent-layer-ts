import type { Context } from "hono";
import { generateLlmsTxt, generateLlmsFullTxt } from "@agent-layer/core";
import type { LlmsTxtConfig, RouteMetadata } from "@agent-layer/core";

/**
 * Create Hono route handlers for GET /llms.txt and /llms-full.txt.
 */
export function llmsTxtRoutes(config: LlmsTxtConfig, routes: RouteMetadata[] = []) {
  const txt = generateLlmsTxt(config);
  const fullTxt = generateLlmsFullTxt(config, routes);

  return {
    /**
     * GET /llms.txt handler — returns the concise version.
     */
    llmsTxt(c: Context): Response {
      return c.text(txt);
    },

    /**
     * GET /llms-full.txt handler — returns the full version with route docs.
     */
    llmsFullTxt(c: Context): Response {
      return c.text(fullTxt);
    },
  };
}
