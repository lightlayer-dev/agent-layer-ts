import type { Context } from "hono";
import { stream } from "hono/streaming";
import {
  createAgUiEmitter,
  AG_UI_HEADERS,
  type AgUiEmitter,
  type AgUiEmitterOptions,
} from "@agent-layer/core";

/**
 * AG-UI stream handler callback for Hono.
 */
export type AgUiStreamHandler = (
  c: Context,
  emit: AgUiEmitter,
) => Promise<void>;

export interface AgUiMiddlewareOptions extends AgUiEmitterOptions {
  onError?: (err: unknown, emit: AgUiEmitter) => void;
}

/**
 * Create a Hono handler that streams AG-UI events over SSE.
 *
 * Usage:
 * ```ts
 * import { agUiStream } from '@agent-layer/hono';
 *
 * app.post('/api/agent', agUiStream(async (c, emit) => {
 *   emit.runStarted();
 *   emit.textStart();
 *   emit.textDelta("Hello from Hono!");
 *   emit.textEnd();
 *   emit.runFinished();
 * }));
 * ```
 */
export function agUiStream(
  handler: AgUiStreamHandler,
  options: AgUiMiddlewareOptions = {},
) {
  return (c: Context) => {
    for (const [key, value] of Object.entries(AG_UI_HEADERS)) {
      c.header(key, value);
    }

    return stream(c, async (s) => {
      const body = await c.req.json().catch(() => ({}));

      const emitter = createAgUiEmitter(
        (chunk: string) => {
          s.write(chunk);
        },
        {
          threadId: options.threadId ?? body?.threadId,
          runId: options.runId,
        },
      );

      try {
        await handler(c, emitter);
      } catch (err) {
        if (options.onError) {
          options.onError(err, emitter);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          emitter.runError(message);
        }
      }
    });
  };
}
