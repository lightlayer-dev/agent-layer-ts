import type { Request, Response, NextFunction, Router } from "express";
import { Router as createRouter } from "express";
import type {
  OnboardingConfig,
  RegistrationRequest,
} from "@agent-layer/core";
import { createOnboardingHandler } from "@agent-layer/core";

/**
 * Express adapter for agent-onboarding.
 *
 * Returns a router with POST /agent/register and an authRequired() middleware
 * that returns 401 for unauthenticated agent requests on non-exempt paths.
 */
export function agentOnboarding(config: OnboardingConfig) {
  const handler = createOnboardingHandler(config);

  function getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
      return first.trim();
    }
    return req.socket?.remoteAddress ?? "unknown";
  }

  /** Returns an Express Router that mounts POST /agent/register. */
  function registerRoute(): Router {
    const router = createRouter();

    router.post("/agent/register", async (req: Request, res: Response): Promise<void> => {
      const body = req.body as RegistrationRequest;
      const ip = getClientIp(req);
      const result = await handler.handleRegister(body, ip);
      res.status(result.status).json(result.body);
    });

    return router;
  }

  /** Middleware that returns 401 for unauthenticated requests on non-exempt paths. */
  function authRequired() {
    return function authRequiredMiddleware(
      req: Request,
      res: Response,
      next: NextFunction,
    ): void {
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        headers[k] = Array.isArray(v) ? v[0] : v;
      }

      if (handler.shouldReturn401(req.path, headers)) {
        res.status(401).json(handler.getAuthRequiredResponse());
        return;
      }
      next();
    };
  }

  return { registerRoute, authRequired };
}
