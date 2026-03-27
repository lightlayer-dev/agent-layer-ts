import type { Context, Next } from "koa";
import { buildErrorResponse, buildNotFoundResponse } from "@agent-layer/core";

export function agentErrors() {
  return async function agentErrorHandler(
    ctx: Context,
    next: Next,
  ): Promise<void> {
    try {
      await next();
    } catch (err: unknown) {
      const error = err as Error;
      const result = buildErrorResponse(
        error,
        ctx.headers.accept,
        ctx.headers["user-agent"],
      );
      ctx.status = result.status;
      for (const [k, v] of Object.entries(result.headers)) {
        ctx.set(k, v);
      }
      if (result.isJson) {
        ctx.body = result.body;
      } else {
        ctx.type = "html";
        ctx.body = result.body;
      }
    }
  };
}

export function notFoundHandler() {
  return async function handleNotFound(
    ctx: Context,
    next: Next,
  ): Promise<void> {
    await next();
    if (ctx.body == null && ctx.status === 404) {
      const result = buildNotFoundResponse(
        ctx.method,
        ctx.path,
        ctx.headers.accept,
        ctx.headers["user-agent"],
      );
      ctx.status = result.status;
      if (result.isJson) {
        ctx.body = result.body;
      } else {
        ctx.type = "html";
        ctx.body = result.body;
      }
    }
  };
}
