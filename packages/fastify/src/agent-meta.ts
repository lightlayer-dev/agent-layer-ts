import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { AgentMetaConfig } from "@agent-layer/core";

/**
 * Fastify plugin for HTML response transforms.
 * Injects data-agent-id attributes, ARIA landmarks, and meta tags.
 */
export function agentMeta(config: AgentMetaConfig = {}) {
  const attrName = config.agentIdAttribute ?? "data-agent-id";
  const injectAria = config.ariaLandmarks !== false;
  const metaTags = config.metaTags ?? {};

  return fp(
    async function agentMetaPlugin(fastify: FastifyInstance) {
      fastify.addHook(
        "onSend",
        async (
          _request: FastifyRequest,
          reply: FastifyReply,
          payload: unknown,
        ) => {
          const contentType = reply.getHeader("content-type");
          const ctStr =
            typeof contentType === "string"
              ? contentType
              : Array.isArray(contentType)
                ? contentType.join(", ")
                : String(contentType ?? "");

          if (typeof payload === "string" && ctStr.includes("text/html")) {
            let html = payload;

            // Inject meta tags into <head>
            const metaTagsHtml = Object.entries(metaTags)
              .map(
                ([name, content]) =>
                  `<meta name="${name}" content="${content}">`,
              )
              .join("\n    ");

            if (metaTagsHtml && html.includes("</head>")) {
              html = html.replace("</head>", `    ${metaTagsHtml}\n</head>`);
            }

            // Add data-agent-id to <body>
            if (html.includes("<body")) {
              html = html.replace("<body", `<body ${attrName}="root"`);
            }

            // Add ARIA landmarks
            if (injectAria && html.includes("<main")) {
              html = html.replace(/<main(?![^>]*role=)/, '<main role="main"');
            }

            return html;
          }

          return payload;
        },
      );
    },
    { name: "agent-layer-meta" },
  );
}
