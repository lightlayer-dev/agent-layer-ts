import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { buildErrorResponse, buildNotFoundResponse } from "@agent-layer/core";

export const agentErrors = fp(
  async function agentErrorsPlugin(fastify: FastifyInstance) {
    fastify.setErrorHandler(
      (err: Error, request: FastifyRequest, reply: FastifyReply) => {
        const result = buildErrorResponse(
          err,
          request.headers.accept,
          request.headers["user-agent"],
        );
        for (const [k, v] of Object.entries(result.headers)) {
          reply.header(k, v);
        }
        reply.status(result.status);
        if (result.isJson) {
          reply.send(result.body);
        } else {
          reply.type("text/html").send(result.body);
        }
      },
    );

    fastify.setNotFoundHandler(
      (request: FastifyRequest, reply: FastifyReply) => {
        const result = buildNotFoundResponse(
          request.method,
          request.url,
          request.headers.accept,
          request.headers["user-agent"],
        );
        reply.status(result.status);
        if (result.isJson) {
          reply.send(result.body);
        } else {
          reply.type("text/html").send(result.body);
        }
      },
    );
  },
  { name: "agent-layer-errors" },
);
