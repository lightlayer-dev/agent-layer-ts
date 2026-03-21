/**
 * Hono middleware for unified multi-format agent discovery.
 *
 * Serves all enabled discovery formats from a single configuration:
 * - /.well-known/ai       → JSON (AI manifest)
 * - /.well-known/agent.json → JSON (A2A Agent Card)
 * - /agents.txt           → text/plain
 * - /llms.txt             → text/plain
 * - /llms-full.txt        → text/plain
 */

import type { Context } from "hono";
import { Hono } from "hono";
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
  /** Combined Hono app with all enabled routes */
  app: Hono;
  /** Individual handlers for custom mounting */
  wellKnownAi: (c: Context) => Response;
  agentCard: (c: Context) => Response;
  agentsTxt: (c: Context) => Response;
  llmsTxt: (c: Context) => Response;
  llmsFullTxt: (c: Context) => Response;
}

/**
 * Create unified discovery routes for Hono.
 *
 * @example
 * ```ts
 * import { unifiedDiscovery } from '@agent-layer/hono';
 *
 * const discovery = unifiedDiscovery({
 *   name: 'My API',
 *   description: 'REST API for widgets',
 *   url: 'https://api.example.com',
 *   skills: [{ id: 'search', name: 'Search', description: 'Full-text search' }],
 * });
 * app.route('/', discovery.app);
 * ```
 */
export function unifiedDiscovery(config: UnifiedDiscoveryConfig): UnifiedDiscoveryHandlers {
  // Pre-generate all documents (they don't change at runtime)
  const aiManifest = generateUnifiedAIManifest(config);
  const agentCardDoc = generateUnifiedAgentCard(config);
  const agentsTxtDoc = generateAgentsTxt(config);
  const llmsTxtDoc = generateUnifiedLlmsTxt(config);
  const llmsFullTxtDoc = generateUnifiedLlmsFullTxt(config);

  const wellKnownAi = (_c: Context): Response =>
    new Response(JSON.stringify(aiManifest), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

  const agentCard = (_c: Context): Response =>
    new Response(JSON.stringify(agentCardDoc), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

  const agentsTxt = (_c: Context): Response =>
    new Response(agentsTxtDoc, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  const llmsTxt = (_c: Context): Response =>
    new Response(llmsTxtDoc, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  const llmsFullTxt = (_c: Context): Response =>
    new Response(llmsFullTxtDoc, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

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
