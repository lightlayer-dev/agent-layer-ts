import type { Context, Next } from "hono";
import type { AgentMetaConfig } from "@agent-layer/core";

/**
 * Hono response-transform middleware for HTML responses.
 * Injects data-agent-id attributes, ARIA landmarks, and meta tags.
 */
export function agentMeta(config: AgentMetaConfig = {}) {
  const attrName = config.agentIdAttribute ?? "data-agent-id";
  const injectAria = config.ariaLandmarks !== false;
  const metaTags = config.metaTags ?? {};

  return async function agentMetaMiddleware(
    c: Context,
    next: Next,
  ): Promise<void> {
    await next();

    // Only transform HTML string responses
    const contentType = c.res.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      const body = await c.res.text();
      let html = body;

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

      c.res = new Response(html, {
        status: c.res.status,
        headers: c.res.headers,
      });
    }
  };
}
