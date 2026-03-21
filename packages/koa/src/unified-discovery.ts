/**
 * Koa middleware for unified multi-format agent discovery.
 */

import Router from "@koa/router";
import type { Context } from "koa";
import type { UnifiedDiscoveryConfig } from "@agent-layer/core";
import {
  generateUnifiedAIManifest,
  generateUnifiedAgentCard,
  generateUnifiedLlmsTxt,
  generateUnifiedLlmsFullTxt,
  generateAgentsTxt,
  isFormatEnabled,
} from "@agent-layer/core";

export interface UnifiedDiscoveryHandlers {
  /** Combined router with all enabled routes */
  router: Router;
  /** Individual handlers for custom mounting */
  wellKnownAi: (ctx: Context) => void;
  agentCard: (ctx: Context) => void;
  agentsTxt: (ctx: Context) => void;
  llmsTxt: (ctx: Context) => void;
  llmsFullTxt: (ctx: Context) => void;
}

/**
 * Create unified discovery routes for Koa.
 */
export function unifiedDiscovery(config: UnifiedDiscoveryConfig): UnifiedDiscoveryHandlers {
  const aiManifest = generateUnifiedAIManifest(config);
  const agentCardDoc = generateUnifiedAgentCard(config);
  const agentsTxtDoc = generateAgentsTxt(config);
  const llmsTxtDoc = generateUnifiedLlmsTxt(config);
  const llmsFullTxtDoc = generateUnifiedLlmsFullTxt(config);

  const wellKnownAi = (ctx: Context): void => {
    ctx.body = aiManifest;
  };

  const agentCard = (ctx: Context): void => {
    ctx.body = agentCardDoc;
  };

  const agentsTxt = (ctx: Context): void => {
    ctx.type = "text/plain";
    ctx.body = agentsTxtDoc;
  };

  const llmsTxt = (ctx: Context): void => {
    ctx.type = "text/plain";
    ctx.body = llmsTxtDoc;
  };

  const llmsFullTxt = (ctx: Context): void => {
    ctx.type = "text/plain";
    ctx.body = llmsFullTxtDoc;
  };

  const router = new Router();

  if (isFormatEnabled(config.formats, "wellKnownAi")) {
    router.get("/.well-known/ai", (ctx) => wellKnownAi(ctx));
  }
  if (isFormatEnabled(config.formats, "agentCard")) {
    router.get("/.well-known/agent.json", (ctx) => agentCard(ctx));
  }
  if (isFormatEnabled(config.formats, "agentsTxt")) {
    router.get("/agents.txt", (ctx) => agentsTxt(ctx));
  }
  if (isFormatEnabled(config.formats, "llmsTxt")) {
    router.get("/llms.txt", (ctx) => llmsTxt(ctx));
    router.get("/llms-full.txt", (ctx) => llmsFullTxt(ctx));
  }

  return { router, wellKnownAi, agentCard, agentsTxt, llmsTxt, llmsFullTxt };
}
