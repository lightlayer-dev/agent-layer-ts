import Router from "@koa/router";
import type { Context, Next } from "koa";
import type {
  OnboardingConfig,
  RegistrationRequest,
} from "@agent-layer/core";
import { createOnboardingHandler } from "@agent-layer/core";

/**
 * Koa adapter for agent-onboarding.
 *
 * Returns a Koa router with POST /agent/register and an authRequired() middleware
 * that returns 401 for unauthenticated agent requests on non-exempt paths.
 */
export function agentOnboarding(config: OnboardingConfig) {
  const handler = createOnboardingHandler(config);

  function getClientIp(ctx: Context): string {
    const forwarded = ctx.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return ctx.ip ?? "unknown";
  }

  /** Returns a Koa Router with POST /agent/register. */
  function registerRoute(): Router {
    const router = new Router();

    router.post("/agent/register", async (ctx: Context) => {
      const body = (ctx.request as any).body as RegistrationRequest;
      const ip = getClientIp(ctx);
      const result = await handler.handleRegister(body, ip);
      ctx.status = result.status;
      ctx.body = result.body;
    });

    return router;
  }

  /** Middleware that returns 401 for unauthenticated requests on non-exempt paths. */
  function authRequired() {
    return async function authRequiredMiddleware(
      ctx: Context,
      next: Next,
    ): Promise<void> {
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(ctx.headers)) {
        headers[k] = Array.isArray(v) ? v[0] : v;
      }

      if (handler.shouldReturn401(ctx.path, headers)) {
        ctx.status = 401;
        ctx.body = handler.getAuthRequiredResponse();
        return;
      }
      await next();
    };
  }

  return { registerRoute, authRequired };
}
