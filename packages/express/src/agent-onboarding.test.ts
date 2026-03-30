import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { agentOnboarding } from "./agent-onboarding.js";
import type { OnboardingConfig } from "@agent-layer/core";

// Mock fetch for webhook calls.
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const baseConfig: OnboardingConfig = {
  provisioningWebhook: "https://hooks.example.com/provision",
};

function createApp(config: OnboardingConfig = baseConfig) {
  const app = express();
  app.use(express.json());
  const onboarding = agentOnboarding(config);
  app.use(onboarding.registerRoute());
  app.use(onboarding.authRequired());
  app.get("/api/data", (_req, res) => res.json({ ok: true }));
  app.get("/llms.txt", (_req, res) => res.send("# LLMs.txt"));
  app.get("/.well-known/agent.json", (_req, res) => res.json({ name: "test" }));
  return app;
}

const validBody = {
  agent_id: "agent-123",
  agent_name: "TestBot",
  agent_provider: "openai",
};

describe("agentOnboarding middleware (Express)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers agent successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "provisioned",
        credentials: { type: "api_key", token: "sk-test-123", header: "X-API-Key" },
      }),
    });

    const app = createApp();
    const res = await request(app).post("/agent/register").send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("provisioned");
    expect(res.body.credentials.token).toBe("sk-test-123");
  });

  it("returns 400 for missing agent_id", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/agent/register")
      .send({ agent_name: "Bot", agent_provider: "openai" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("missing_field");
  });

  it("returns 400 for missing agent_name", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/agent/register")
      .send({ agent_id: "a1", agent_provider: "openai" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("missing_field");
  });

  it("returns 400 for missing agent_provider", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/agent/register")
      .send({ agent_id: "a1", agent_name: "Bot" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("missing_field");
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

    await request(app).post("/agent/register").send(validBody);
    await request(app).post("/agent/register").send(validBody);
    const res = await request(app).post("/agent/register").send(validBody);

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("rate_limit_exceeded");
  });

  it("returns 401 for unauthenticated request on non-exempt path", async () => {
    const app = createApp();
    const res = await request(app).get("/api/data");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("auth_required");
    expect(res.body.register_url).toBe("/agent/register");
  });

  it("passes through requests with Authorization header", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/data")
      .set("Authorization", "Bearer sk-test");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("passes through requests with X-API-Key header", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/data")
      .set("X-API-Key", "key-123");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("does not block /llms.txt (exempt path)", async () => {
    const app = createApp();
    const res = await request(app).get("/llms.txt");

    expect(res.status).toBe(200);
  });

  it("does not block /.well-known/ paths", async () => {
    const app = createApp();
    const res = await request(app).get("/.well-known/agent.json");

    expect(res.status).toBe(200);
  });

  it("returns 403 for disallowed provider", async () => {
    const config: OnboardingConfig = {
      ...baseConfig,
      allowedProviders: ["anthropic"],
    };
    const app = createApp(config);
    const res = await request(app).post("/agent/register").send(validBody);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("provider_not_allowed");
  });

  it("returns 502 when webhook fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const app = createApp();
    const res = await request(app).post("/agent/register").send(validBody);

    expect(res.status).toBe(502);
    expect(res.body.code).toBe("webhook_error");
  });

  it("includes auth_docs in 401 response when configured", async () => {
    const config: OnboardingConfig = {
      ...baseConfig,
      authDocs: "https://docs.example.com/auth",
    };
    const app = createApp(config);
    const res = await request(app).get("/api/data");

    expect(res.status).toBe(401);
    expect(res.body.auth_docs).toBe("https://docs.example.com/auth");
  });
});
