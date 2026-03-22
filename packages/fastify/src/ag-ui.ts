import type { FastifyRequest, FastifyReply } from "fastify";
import {
  createAgUiEmitter,
  AG_UI_HEADERS,
  type AgUiEmitter,
  type AgUiEmitterOptions,
} from "@agent-layer/core";

/**
 * AG-UI stream handler callback for Fastify.
 */
export type AgUiStreamHandler = (
  request: FastifyRequest,
  emit: AgUiEmitter,
) => Promise<void>;

export interface AgUiMiddlewareOptions extends AgUiEmitterOptions {
  onError?: (err: unknown, emit: AgUiEmitter) => void;
}

/**
 * Create a Fastify handler that streams AG-UI events over SSE.
 *
 * Usage:
 * ```ts
 * import { agUiStream } from '@agent-layer/fastify';
 *
 * fastify.post('/api/agent', agUiStream(async (request, emit) => {
 *   emit.runStarted();
 *   emit.textStart();
 *   emit.textDelta("Hello from Fastify!");
 *   emit.textEnd();
 *   emit.runFinished();
 * }));
 * ```
 */
export function agUiStream(
  handler: AgUiStreamHandler,
  options: AgUiMiddlewareOptions = {},
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Set SSE headers
    for (const [key, value] of Object.entries(AG_UI_HEADERS)) {
      reply.raw.setHeader(key, value);
    }
    reply.raw.writeHead(200);

    const body = request.body as Record<string, unknown> | undefined;

    const emitter = createAgUiEmitter(
      (chunk: string) => {
        if (!reply.raw.writableEnded) {
          reply.raw.write(chunk);
        }
      },
      {
        threadId: options.threadId ?? (body?.threadId as string | undefined),
        runId: options.runId,
      },
    );

    try {
      await handler(request, emitter);
    } catch (err) {
      if (options.onError) {
        options.onError(err, emitter);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        emitter.runError(message);
      }
    } finally {
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
    }
  };
}
