import type { Context, Next } from "koa";
import type { AgentMetaConfig } from "@agent-layer/core";

/**
 * Koa response-transform middleware for HTML responses.
 * Injects data-agent-id attributes, ARIA landmarks, and meta tags.
 */
export function agentMeta(config: AgentMetaConfig = {}) {
  const attrName = config.agentIdAttribute ?? "data-agent-id";
  const injectAria = config.ariaLandmarks !== false;
  const metaTags = config.metaTags ?? {};

  return async function agentMetaMiddleware(
    ctx: Context,
    next: Next,
  ): Promise<void> {
    await next();

    // Only transform HTML string responses
    const contentType = ctx.type || "";
    if (
      typeof ctx.body === "string" &&
      contentType.includes("text/html")
    ) {
      let html = ctx.body;

      // Inject meta tags into <head>
      const metaTagsHtml = Object.entries(metaTags)
        .map(([name, content]) => `<meta name="${name}" content="${content}">`)
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
        html = html.replace(
          /<main(?![^>]*role=)/,
          '<main role="main"',
        );
      }

      ctx.body = html;
    }
  };
}
