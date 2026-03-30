import { Hono } from "hono";
import type { Context, Next } from "hono";
import type {
  OnboardingConfig,
  RegistrationRequest,
} from "@agent-layer/core";
import { createOnboardingHandler } from "@agent-layer/core";

/**
 * Hono adapter for agent-onboarding.
 *
 * Returns a Hono app with POST /agent/register and an authRequired() middleware
 * that returns 401 for unauthenticated agent requests on non-exempt paths.
 */
export function agentOnboarding(config: OnboardingConfig) {
  const handler = createOnboardingHandler(config);

  function getClientIp(c: Context): string {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return "unknown";
  }

  /** Returns a Hono app with POST /agent/register. */
  function registerRoute(): Hono {
    const app = new Hono();

    app.post("/agent/register", async (c) => {
      const body = (await c.req.json()) as RegistrationRequest;
      const ip = getClientIp(c);
      const result = await handler.handleRegister(body, ip);
      return c.json(result.body, result.status as any);
    });

    return app;
  }

  /** Middleware that returns 401 for unauthenticated requests on non-exempt paths. */
  function authRequired() {
    return async function authRequiredMiddleware(
      c: Context,
      next: Next,
    ): Promise<Response | void> {
      const headers: Record<string, string | undefined> = {};
      c.req.raw.headers.forEach((value, key) => {
        headers[key] = value;
      });

      if (handler.shouldReturn401(c.req.path, headers)) {
        return c.json(handler.getAuthRequiredResponse(), 401);
      }
      await next();
    };
  }

  return { registerRoute, authRequired };
}
