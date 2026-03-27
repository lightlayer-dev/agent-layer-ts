/**
 * Express middleware: sets security headers on all responses.
 */
import type { RequestHandler } from "express";
import { generateSecurityHeaders } from "@agent-layer/core";
import type { SecurityHeadersConfig } from "@agent-layer/core";

export { type SecurityHeadersConfig } from "@agent-layer/core";

/**
 * Express middleware that sets security headers on every response.
 * Defaults are safe and score 10/10 on agent-readiness checks.
 */
export function securityHeaders(config: SecurityHeadersConfig = {}): RequestHandler {
  const headers = generateSecurityHeaders(config);

  return (_req, res, next) => {
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    next();
  };
}
