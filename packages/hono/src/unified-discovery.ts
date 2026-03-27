import { Hono } from "hono";
import type { Context } from "hono";
import type { UnifiedDiscoveryConfig } from "@agent-layer/core";
import {
  generateUnifiedAIManifest,
  generateUnifiedAgentCard,
  generateUnifiedLlmsTxt,
  generateUnifiedLlmsFullTxt,
  generateAgentsTxt,
  isFormatEnabled,
} from "@agent-layer/core";

export function unifiedDiscovery(config: UnifiedDiscoveryConfig) {
  const aiManifest = generateUnifiedAIManifest(config);
  const agentCardDoc = generateUnifiedAgentCard(config);
  const agentsTxtDoc = generateAgentsTxt(config);
  const llmsTxtDoc = generateUnifiedLlmsTxt(config);
  const llmsFullTxtDoc = generateUnifiedLlmsFullTxt(config);

  const wellKnownAi = (c: Context): Response => c.json(aiManifest);
  const agentCard = (c: Context): Response => c.json(agentCardDoc);
  const agentsTxt = (c: Context): Response => {
    c.header("Content-Type", "text/plain");
    return c.text(agentsTxtDoc);
  };
  const llmsTxt = (c: Context): Response => {
    c.header("Content-Type", "text/plain");
    return c.text(llmsTxtDoc);
  };
  const llmsFullTxt = (c: Context): Response => {
    c.header("Content-Type", "text/plain");
    return c.text(llmsFullTxtDoc);
  };

  const app = new Hono();

  if (isFormatEnabled(config.formats, "wellKnownAi")) {
    app.get("/.well-known/ai", (c) => wellKnownAi(c));
  }
  if (isFormatEnabled(config.formats, "agentCard")) {
    app.get("/.well-known/agent.json", (c) => agentCard(c));
  }
  if (isFormatEnabled(config.formats, "agentsTxt")) {
    app.get("/agents.txt", (c) => agentsTxt(c));
  }
  if (isFormatEnabled(config.formats, "llmsTxt")) {
    app.get("/llms.txt", (c) => llmsTxt(c));
    app.get("/llms-full.txt", (c) => llmsFullTxt(c));
  }

  return { app, wellKnownAi, agentCard, agentsTxt, llmsTxt, llmsFullTxt };
}
