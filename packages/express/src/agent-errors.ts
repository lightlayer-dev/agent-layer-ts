import type { Request, Response, NextFunction } from "express";
import { buildErrorResponse, buildNotFoundResponse } from "@agent-layer/core";

export function agentErrors() {
  return function agentErrorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    const result = buildErrorResponse(
      err,
      req.headers.accept,
      req.headers["user-agent"],
    );
    for (const [k, v] of Object.entries(result.headers)) {
      res.setHeader(k, v);
    }
    res.status(result.status);
    if (result.isJson) {
      res.json(result.body);
    } else {
      res.type("html").send(result.body);
    }
  };
}

export function notFoundHandler() {
  return function handleNotFound(req: Request, res: Response, _next: NextFunction): void {
    const result = buildNotFoundResponse(
      req.method,
      req.path,
      req.headers.accept,
      req.headers["user-agent"],
    );
    res.status(result.status);
    if (result.isJson) {
      res.json(result.body);
    } else {
      res.type("html").send(result.body);
    }
  };
}
