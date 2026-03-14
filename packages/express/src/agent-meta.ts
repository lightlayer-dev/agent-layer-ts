import type { Request, Response, NextFunction } from "express";
import type { AgentMetaConfig } from "@agent-layer/core";

/**
 * Express response-transform middleware for HTML responses.
 * Injects data-agent-id attributes, ARIA landmarks, and meta tags.
 */
export function agentMeta(config: AgentMetaConfig = {}) {
  const attrName = config.agentIdAttribute ?? "data-agent-id";
  const injectAria = config.ariaLandmarks !== false;
  const metaTags = config.metaTags ?? {};

  return function agentMetaMiddleware(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const originalSend = res.send.bind(res);

    res.send = function agentMetaSend(body?: unknown): Response {
      // Only transform HTML string responses
      if (
        typeof body === "string" &&
        (res.getHeader("content-type") ?? "").toString().includes("text/html")
      ) {
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

        return originalSend(html);
      }

      return originalSend(body);
    } as typeof res.send;

    next();
  };
}
