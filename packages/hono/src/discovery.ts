import type { Context } from "hono";
import { generateAIManifest, generateJsonLd } from "@agent-layer/core";
import type { DiscoveryConfig } from "@agent-layer/core";

/**
 * Create Hono route handlers for /.well-known/ai and /openapi.json.
 */
export function discoveryRoutes(config: DiscoveryConfig) {
  const manifest = generateAIManifest(config);
  const jsonLd = generateJsonLd(config);

  return {
    /**
     * GET /.well-known/ai handler.
     */
    wellKnownAi(c: Context): Response {
      return c.json(manifest);
    },

    /**
     * GET /openapi.json handler.
     */
    openApiJson(c: Context): Response {
      if (config.openApiSpec) {
        return c.json(config.openApiSpec);
      } else {
        return c.json(
          {
            error: {
              type: "not_found_error",
              code: "no_openapi_spec",
              message: "No OpenAPI spec has been configured.",
              status: 404,
              is_retriable: false,
            },
          },
          404,
        );
      }
    },

    /**
     * Returns JSON-LD structured data for embedding in HTML.
     */
    jsonLd(c: Context): Response {
      return c.json(jsonLd);
    },
  };
}
