/**
 * Express middleware for unified multi-format agent discovery.
 *
 * Serves all enabled discovery formats from a single configuration:
 * - /.well-known/ai       → JSON (AI manifest)
 * - /.well-known/agent.json → JSON (A2A Agent Card)
 * - /agents.txt           → text/plain
 * - /llms.txt             → text/plain
 * - /llms-full.txt        → text/plain
 */

import type { Router, Request, Response } from "express";
import { Router as createRouter } from "express";
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
  wellKnownAi: (req: Request, res: Response) => void;
  agentCard: (req: Request, res: Response) => void;
  agentsTxt: (req: Request, res: Response) => void;
  llmsTxt: (req: Request, res: Response) => void;
  llmsFullTxt: (req: Request, res: Response) => void;
}

/**
 * Create unified discovery routes from a single config.
 *
 * @example
 * ```ts
 * import { unifiedDiscovery } from '@agent-layer/express';
 *
 * app.use(unifiedDiscovery({
 *   name: 'My API',
 *   description: 'REST API for widgets',
 *   url: 'https://api.example.com',
 *   skills: [{ id: 'search', name: 'Search', description: 'Full-text search' }],
 *   auth: { type: 'oauth2', scopes: { read: 'Read access' } },
 * }).router);
 * ```
 */
export function unifiedDiscovery(config: UnifiedDiscoveryConfig): UnifiedDiscoveryHandlers {
  // Pre-generate all documents (they don't change at runtime)
  const aiManifest = generateUnifiedAIManifest(config);
  const agentCardDoc = generateUnifiedAgentCard(config);
  const agentsTxtDoc = generateAgentsTxt(config);
  const llmsTxtDoc = generateUnifiedLlmsTxt(config);
  const llmsFullTxtDoc = generateUnifiedLlmsFullTxt(config);

  const wellKnownAi = (_req: Request, res: Response): void => {
    res.json(aiManifest);
  };

  const agentCard = (_req: Request, res: Response): void => {
    res.json(agentCardDoc);
  };

  const agentsTxt = (_req: Request, res: Response): void => {
    res.type("text/plain").send(agentsTxtDoc);
  };

  const llmsTxt = (_req: Request, res: Response): void => {
    res.type("text/plain").send(llmsTxtDoc);
  };

  const llmsFullTxt = (_req: Request, res: Response): void => {
    res.type("text/plain").send(llmsFullTxtDoc);
  };

  const router = createRouter();

  if (isFormatEnabled(config.formats, "wellKnownAi")) {
    router.get("/.well-known/ai", wellKnownAi);
  }
  if (isFormatEnabled(config.formats, "agentCard")) {
    router.get("/.well-known/agent.json", agentCard);
  }
  if (isFormatEnabled(config.formats, "agentsTxt")) {
    router.get("/agents.txt", agentsTxt);
  }
  if (isFormatEnabled(config.formats, "llmsTxt")) {
    router.get("/llms.txt", llmsTxt);
    router.get("/llms-full.txt", llmsFullTxt);
  }

  return { router, wellKnownAi, agentCard, agentsTxt, llmsTxt, llmsFullTxt };
}
