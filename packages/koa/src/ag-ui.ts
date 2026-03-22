import type { Context } from "koa";
import {
  createAgUiEmitter,
  AG_UI_HEADERS,
  type AgUiEmitter,
  type AgUiEmitterOptions,
} from "@agent-layer/core";

/**
 * AG-UI stream handler callback for Koa.
 */
export type AgUiStreamHandler = (
  ctx: Context,
  emit: AgUiEmitter,
) => Promise<void>;

export interface AgUiMiddlewareOptions extends AgUiEmitterOptions {
  onError?: (err: unknown, emit: AgUiEmitter) => void;
}

/**
 * Create a Koa middleware that streams AG-UI events over SSE.
 *
 * Usage:
 * ```ts
 * import { agUiStream } from '@agent-layer/koa';
 *
 * router.post('/api/agent', agUiStream(async (ctx, emit) => {
 *   emit.runStarted();
 *   emit.textStart();
 *   emit.textDelta("Hello from Koa!");
 *   emit.textEnd();
 *   emit.runFinished();
 * }));
 * ```
 */
export function agUiStream(
  handler: AgUiStreamHandler,
  options: AgUiMiddlewareOptions = {},
) {
  return async (ctx: Context): Promise<void> => {
    // Set SSE headers
    for (const [key, value] of Object.entries(AG_UI_HEADERS)) {
      ctx.set(key, value);
    }
    ctx.status = 200;
    ctx.respond = false; // Bypass Koa's default response handling

    const res = ctx.res;

    const emitter = createAgUiEmitter(
      (chunk: string) => {
        if (!res.writableEnded) {
          res.write(chunk);
        }
      },
      {
        threadId: options.threadId ?? ((ctx.request as any).body as Record<string, unknown>)?.threadId as string | undefined,
        runId: options.runId,
      },
    );

    try {
      await handler(ctx, emitter);
    } catch (err) {
      if (options.onError) {
        options.onError(err, emitter);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        emitter.runError(message);
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  };
}
