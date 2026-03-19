import type { Context } from "koa";
import { generateLlmsTxt, generateLlmsFullTxt } from "@agent-layer/core";
import type { LlmsTxtConfig, RouteMetadata } from "@agent-layer/core";

/**
 * Create Koa route handlers for GET /llms.txt and /llms-full.txt.
 */
export function llmsTxtRoutes(config: LlmsTxtConfig, routes: RouteMetadata[] = []) {
  const txt = generateLlmsTxt(config);
  const fullTxt = generateLlmsFullTxt(config, routes);

  return {
    /**
     * GET /llms.txt handler — returns the concise version.
     */
    llmsTxt(ctx: Context): void {
      ctx.type = "text/plain";
      ctx.body = txt;
    },

    /**
     * GET /llms-full.txt handler — returns the full version with route docs.
     */
    llmsFullTxt(ctx: Context): void {
      ctx.type = "text/plain";
      ctx.body = fullTxt;
    },
  };
}
