import type { Request, Response, NextFunction } from "express";
import {
  createAgUiEmitter,
  AG_UI_HEADERS,
  type AgUiEmitter,
  type AgUiEmitterOptions,
} from "@agent-layer/core";

/**
 * AG-UI stream handler callback.
 * Receives the request and an emitter for sending AG-UI events.
 */
export type AgUiStreamHandler = (
  req: Request,
  emit: AgUiEmitter,
) => Promise<void>;

export interface AgUiMiddlewareOptions extends AgUiEmitterOptions {
  /**
   * Called when the handler throws. Defaults to emitting RUN_ERROR
   * and closing the stream.
   */
  onError?: (err: unknown, emit: AgUiEmitter, res: Response) => void;
}

/**
 * Create an Express handler that streams AG-UI events over SSE.
 *
 * Usage:
 * ```ts
 * import { agUiStream } from '@agent-layer/express';
 *
 * app.post('/api/agent', agUiStream(async (req, emit) => {
 *   emit.runStarted();
 *   emit.textStart();
 *   for await (const chunk of myAgent.run(req.body.prompt)) {
 *     emit.textDelta(chunk);
 *   }
 *   emit.textEnd();
 *   emit.runFinished();
 * }));
 * ```
 */
export function agUiStream(
  handler: AgUiStreamHandler,
  options: AgUiMiddlewareOptions = {},
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, _next: NextFunction) => {
    // Set SSE headers
    for (const [key, value] of Object.entries(AG_UI_HEADERS)) {
      res.setHeader(key, value);
    }
    res.flushHeaders();

    const emitter = createAgUiEmitter(
      (chunk: string) => {
        if (!res.writableEnded) {
          res.write(chunk);
        }
      },
      {
        threadId: options.threadId ?? (req.body?.threadId as string | undefined),
        runId: options.runId,
      },
    );

    handler(req, emitter)
      .then(() => {
        if (!res.writableEnded) {
          res.end();
        }
      })
      .catch((err) => {
        if (options.onError) {
          options.onError(err, emitter, res);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          emitter.runError(message);
          if (!res.writableEnded) {
            res.end();
          }
        }
      });
  };
}
