import type { Request, Response } from "express";
import { generateUnifiedDiscovery } from "@agent-layer/core";
import type { UnifiedDiscoveryConfig } from "@agent-layer/core";

/**
 * Create Express route handlers for all agent discovery formats from a single config.
 *
 * Returns handlers for:
 * - GET /.well-known/ai
 * - GET /.well-known/agent.json
 * - GET /agents.txt
 * - GET /llms.txt
 * - GET /llms-full.txt
 * - GET /openapi.json (if spec provided)
 */
export function unifiedDiscoveryRoutes(config: UnifiedDiscoveryConfig) {
  const output = generateUnifiedDiscovery(config);

  return {
    /** GET /.well-known/ai */
    wellKnownAi: output.wellKnownAi
      ? (_req: Request, res: Response): void => {
          res.json(output.wellKnownAi);
        }
      : undefined,

    /** GET /.well-known/agent.json (A2A Agent Card) */
    agentCard: output.agentCard
      ? (_req: Request, res: Response): void => {
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.json(output.agentCard);
        }
      : undefined,

    /** GET /agents.txt */
    agentsTxt: output.agentsTxt
      ? (_req: Request, res: Response): void => {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.send(output.agentsTxt);
        }
      : undefined,

    /** GET /llms.txt */
    llmsTxt: output.llmsTxt
      ? (_req: Request, res: Response): void => {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.send(output.llmsTxt);
        }
      : undefined,

    /** GET /llms-full.txt */
    llmsFullTxt: output.llmsFullTxt
      ? (_req: Request, res: Response): void => {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.send(output.llmsFullTxt);
        }
      : undefined,

    /** GET /openapi.json */
    openApiJson: config.openApiSpec
      ? (_req: Request, res: Response): void => {
          res.json(config.openApiSpec);
        }
      : undefined,

    /** JSON-LD for embedding */
    jsonLd: output.jsonLd
      ? (_req: Request, res: Response): void => {
          res.json(output.jsonLd);
        }
      : undefined,
  };
}
