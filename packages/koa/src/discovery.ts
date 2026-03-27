import type { Context } from "koa";
import { generateAIManifest, generateJsonLd } from "@agent-layer/core";
import type { DiscoveryConfig } from "@agent-layer/core";

/**
 * Create Koa route handlers for /.well-known/ai and /openapi.json.
 */
export function discoveryRoutes(config: DiscoveryConfig) {
  const manifest = generateAIManifest(config);
  const jsonLd = generateJsonLd(config);

  return {
    /**
     * GET /.well-known/ai handler.
     */
    wellKnownAi(ctx: Context): void {
      ctx.body = manifest;
    },

    /**
     * GET /openapi.json handler.
     */
    openApiJson(ctx: Context): void {
      if (config.openApiSpec) {
        ctx.body = config.openApiSpec;
      } else {
        ctx.status = 404;
        ctx.body = {
          error: {
            type: "not_found_error",
            code: "no_openapi_spec",
            message: "No OpenAPI spec has been configured.",
            status: 404,
            is_retriable: false,
          },
        };
      }
    },

    /**
     * Returns JSON-LD structured data for embedding in HTML.
     */
    jsonLd(ctx: Context): void {
      ctx.body = jsonLd;
    },
  };
}
