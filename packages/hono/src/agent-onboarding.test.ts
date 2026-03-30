import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { agentOnboarding } from "./agent-onboarding.js";
import type { OnboardingConfig } from "@agent-layer/core";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const baseConfig: OnboardingConfig = {
  provisioningWebhook: "https://hooks.example.com/provision",
};

function createApp(config: OnboardingConfig = baseConfig) {
  const app = new Hono();
  const onboarding = agentOnboarding(config);
  app.route("/", onboarding.registerRoute());
  app.use("/*", onboarding.authRequired());
  app.get("/api/data", (c) => c.json({ ok: true }));
  app.get("/llms.txt", (c) => c.text("# LLMs.txt"));
  app.get("/.well-known/agent.json", (c) => c.json({ name: "test" }));
  return app;
}

const validBody = {
  agent_id: "agent-123",
  agent_name: "TestBot",
  agent_provider: "openai",
};

async function req(app: Hono, method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["content-type"] = "application/json";
  }
  return app.request(path, init);
}

describe("agentOnboarding middleware (Hono)", () => {
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
    const res = await req(app, "POST", "/agent/register", validBody);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("provisioned");
  });

  it("returns 400 for missing agent_id", async () => {
    const app = createApp();
    const res = await req(app, "POST", "/agent/register", {
      agent_name: "Bot",
      agent_provider: "openai",
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("missing_field");
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

    await req(app, "POST", "/agent/register", validBody);
    await req(app, "POST", "/agent/register", validBody);
    const res = await req(app, "POST", "/agent/register", validBody);

    expect(res.status).toBe(429);
  });

  it("returns 401 for unauthenticated request", async () => {
    const app = createApp();
    const res = await req(app, "GET", "/api/data");

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("auth_required");
  });

  it("passes through with Authorization header", async () => {
    const app = createApp();
    const res = await req(app, "GET", "/api/data", undefined, {
      authorization: "Bearer sk-test",
    });
    expect(res.status).toBe(200);
  });

  it("does not block /llms.txt", async () => {
    const app = createApp();
    const res = await req(app, "GET", "/llms.txt");
    expect(res.status).toBe(200);
  });

  it("does not block /.well-known/ paths", async () => {
    const app = createApp();
    const res = await req(app, "GET", "/.well-known/agent.json");
    expect(res.status).toBe(200);
  });

  it("returns 403 for disallowed provider", async () => {
    const config: OnboardingConfig = {
      ...baseConfig,
      allowedProviders: ["anthropic"],
    };
    const app = createApp(config);
    const res = await req(app, "POST", "/agent/register", validBody);
    expect(res.status).toBe(403);
  });

  it("returns 502 when webhook fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    const app = createApp();
    const res = await req(app, "POST", "/agent/register", validBody);
    expect(res.status).toBe(502);
  });
});
