import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { generateAIManifest, generateJsonLd } from "@agent-layer/core";
import type { DiscoveryConfig } from "@agent-layer/core";

/**
 * Fastify plugin that registers /.well-known/ai and /openapi.json routes.
 */
export function discoveryRoutes(config: DiscoveryConfig) {
  return fp(
    async function discoveryPlugin(fastify: FastifyInstance) {
      const manifest = generateAIManifest(config);
      const jsonLd = generateJsonLd(config);

      fastify.get("/.well-known/ai", async (_request, reply) => {
        reply.send(manifest);
      });

      fastify.get("/openapi.json", async (_request, reply) => {
        if (config.openApiSpec) {
          reply.send(config.openApiSpec);
        } else {
          reply.status(404).send({
            error: {
              type: "not_found_error",
              code: "no_openapi_spec",
              message: "No OpenAPI spec has been configured.",
              status: 404,
              is_retriable: false,
            },
          });
        }
      });

      // Expose jsonLd for embedding
      fastify.get("/.well-known/jsonld", async (_request, reply) => {
        reply.send(jsonLd);
      });
    },
    { name: "agent-layer-discovery" },
  );
}
