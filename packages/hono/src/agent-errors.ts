import type { Context, ErrorHandler } from "hono";
import { buildErrorResponse, buildNotFoundResponse } from "@agent-layer/core";

export function agentErrors(): ErrorHandler {
  return (err: Error, c: Context) => {
    const result = buildErrorResponse(
      err,
      c.req.header("accept"),
      c.req.header("user-agent"),
    );
    for (const [k, v] of Object.entries(result.headers)) {
      c.header(k, v);
    }
    if (result.isJson) {
      return c.json(result.body, result.status as any);
    } else {
      return c.html(result.body as string, result.status as any);
    }
  };
}

export function notFoundHandler() {
  return (c: Context): Response => {
    const result = buildNotFoundResponse(
      c.req.method,
      c.req.path,
      c.req.header("accept"),
      c.req.header("user-agent"),
    );
    if (result.isJson) {
      return c.json(result.body, 404);
    } else {
      return c.html(result.body as string, 404);
    }
  };
}
