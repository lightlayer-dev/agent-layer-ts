import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { AgentError, formatError, notFoundError } from "@agent-layer/core";
import type { AgentErrorEnvelope } from "@agent-layer/core";

/**
 * Determine whether the client prefers JSON (i.e., is an agent) based on Accept header.
 */
function prefersJson(request: FastifyRequest): boolean {
  const accept = request.headers.accept ?? "";
  if (accept.includes("application/json")) return true;
  if (accept.includes("text/html")) return false;
  const ua = request.headers["user-agent"] ?? "";
  if (!ua || /bot|crawl|spider|agent|curl|httpie|python|node|go-http/i.test(ua)) {
    return true;
  }
  return false;
}

function renderHtmlError(envelope: AgentErrorEnvelope): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Error ${envelope.status}</title></head>
<body>
  <h1>${envelope.status} — ${envelope.code}</h1>
  <p>${envelope.message}</p>
</body>
</html>`;
}

/**
 * Fastify plugin that adds structured error handling.
 * Content-negotiates between JSON (for agents) and HTML (for browsers).
 */
export const agentErrors = fp(
  async function agentErrorsPlugin(fastify: FastifyInstance) {
    fastify.setErrorHandler(
      (err: Error, request: FastifyRequest, reply: FastifyReply) => {
        let envelope: AgentErrorEnvelope;

        if (err instanceof AgentError) {
          envelope = err.envelope;
        } else {
          const status =
            (err as unknown as { status?: number }).status ??
            (err as unknown as { statusCode?: number }).statusCode ??
            500;
          envelope = formatError({
            code: "internal_error",
            message: err.message || "An unexpected error occurred.",
            status,
          });
        }

        if (envelope.retry_after != null) {
          reply.header("Retry-After", String(envelope.retry_after));
        }

        reply.status(envelope.status);

        if (prefersJson(request)) {
          reply.send({ error: envelope });
        } else {
          reply.type("text/html").send(renderHtmlError(envelope));
        }
      },
    );

    fastify.setNotFoundHandler(
      (request: FastifyRequest, reply: FastifyReply) => {
        const envelope = notFoundError(
          `No route matches ${request.method} ${request.url}`,
        );

        reply.status(404);

        if (prefersJson(request)) {
          reply.send({ error: envelope });
        } else {
          reply.type("text/html").send(renderHtmlError(envelope));
        }
      },
    );
  },
  { name: "agent-layer-errors" },
);
