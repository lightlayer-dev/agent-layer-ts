import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import type {
  OnboardingConfig,
  RegistrationRequest,
} from "@agent-layer/core";
import { createOnboardingHandler } from "@agent-layer/core";

/**
 * Fastify adapter for agent-onboarding.
 *
 * Returns a Fastify plugin that mounts POST /agent/register and an
 * authRequired hook returning 401 for unauthenticated agent requests.
 */
export function agentOnboarding(config: OnboardingConfig) {
  const handler = createOnboardingHandler(config);

  function getClientIp(request: FastifyRequest): string {
    const forwarded = request.headers["x-forwarded-for"];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
      return first.trim();
    }
    return request.ip ?? "unknown";
  }

  /** Fastify plugin that registers POST /agent/register. */
  const registerPlugin = fp(
    async function agentOnboardingRegisterPlugin(fastify: FastifyInstance) {
      fastify.post("/agent/register", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as RegistrationRequest;
        const ip = getClientIp(request);
        const result = await handler.handleRegister(body, ip);
        reply.status(result.status).send(result.body);
      });
    },
    { name: "agent-layer-onboarding-register" },
  );

  /** Hook that returns 401 for unauthenticated requests on non-exempt paths. */
  function authRequired() {
    return async function authRequiredHook(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(request.headers)) {
        headers[k] = Array.isArray(v) ? v[0] : v;
      }

      if (handler.shouldReturn401(request.url, headers)) {
        reply.status(401).send(handler.getAuthRequiredResponse());
      }
    };
  }

  return { registerPlugin, authRequired };
}
