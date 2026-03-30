import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { agentOnboarding } from "./agent-onboarding.js";
import type { OnboardingConfig } from "@agent-layer/core";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const baseConfig: OnboardingConfig = {
  provisioningWebhook: "https://hooks.example.com/provision",
};

const validBody = {
  agent_id: "agent-123",
  agent_name: "TestBot",
  agent_provider: "openai",
};

function createApp(config: OnboardingConfig = baseConfig) {
  const app = Fastify();
  const onboarding = agentOnboarding(config);
  app.register(onboarding.registerPlugin);
  app.addHook("onRequest", onboarding.authRequired());
  app.get("/api/data", async () => ({ ok: true }));
  app.get("/llms.txt", async (_req, reply) => {
    reply.type("text/plain").send("# LLMs.txt");
  });
  app.get("/.well-known/agent.json", async () => ({ name: "test" }));
  return app;
}

describe("agentOnboarding (Fastify)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers agent successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "provisioned",
        credentials: { type: "api_key", token: "sk-test-123" },
      }),
    });

    const app = createApp();
    const res = await app.inject({
      method: "POST",
      url: "/agent/register",
      payload: validBody,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("provisioned");
  });

  it("returns 400 for missing agent_id", async () => {
    const app = createApp();
    const res = await app.inject({
      method: "POST",
      url: "/agent/register",
      payload: { agent_name: "Bot", agent_provider: "openai" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("missing_field");
  });

  it("returns 429 when rate limited", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "provisioned", credentials: { type: "api_key", token: "t" } }),
    });

    const config: OnboardingConfig = {
      ...baseConfig,
      rateLimit: { maxRegistrations: 2, windowMs: 60_000 },
    };
    const app = createApp(config);

    await app.inject({ method: "POST", url: "/agent/register", payload: validBody });
    await app.inject({ method: "POST", url: "/agent/register", payload: validBody });
    const res = await app.inject({ method: "POST", url: "/agent/register", payload: validBody });

    expect(res.statusCode).toBe(429);
  });

  it("returns 401 for unauthenticated request", async () => {
    const app = createApp();
    const res = await app.inject({ method: "GET", url: "/api/data" });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("auth_required");
  });

  it("passes through with Authorization header", async () => {
    const app = createApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/data",
      headers: { authorization: "Bearer sk-test" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("does not block /llms.txt", async () => {
    const app = createApp();
    const res = await app.inject({ method: "GET", url: "/llms.txt" });
    expect(res.statusCode).toBe(200);
  });

  it("does not block /.well-known/ paths", async () => {
    const app = createApp();
    const res = await app.inject({ method: "GET", url: "/.well-known/agent.json" });
    expect(res.statusCode).toBe(200);
  });

  it("returns 403 for disallowed provider", async () => {
    const config: OnboardingConfig = {
      ...baseConfig,
      allowedProviders: ["anthropic"],
    };
    const app = createApp(config);
    const res = await app.inject({
      method: "POST",
      url: "/agent/register",
      payload: validBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 502 when webhook fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    const app = createApp();
    const res = await app.inject({
      method: "POST",
      url: "/agent/register",
      payload: validBody,
    });
    expect(res.statusCode).toBe(502);
  });
});
