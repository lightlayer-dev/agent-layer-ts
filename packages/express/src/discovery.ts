import type { Request, Response } from "express";
import { generateAIManifest, generateJsonLd } from "@agent-layer/core";
import type { DiscoveryConfig } from "@agent-layer/core";

/**
 * Create Express route handlers for /.well-known/ai and /openapi.json.
 */
export function discoveryRoutes(config: DiscoveryConfig) {
  const manifest = generateAIManifest(config);
  const jsonLd = generateJsonLd(config);

  return {
    /**
     * GET /.well-known/ai handler.
     */
    wellKnownAi(_req: Request, res: Response): void {
      res.json(manifest);
    },

    /**
     * GET /openapi.json handler.
     */
    openApiJson(_req: Request, res: Response): void {
      if (config.openApiSpec) {
        res.json(config.openApiSpec);
      } else {
        res.status(404).json({
          error: {
            type: "not_found_error",
            code: "no_openapi_spec",
            message: "No OpenAPI spec has been configured.",
            status: 404,
            is_retriable: false,
          },
        });
      }
    },

    /**
     * Returns JSON-LD structured data for embedding in HTML.
     */
    jsonLd(_req: Request, res: Response): void {
      res.json(jsonLd);
    },
  };
}
