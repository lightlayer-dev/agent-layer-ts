import { describe, it, expect, vi, beforeEach } from "vitest";
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import request from "supertest";
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
  const app = new Koa();
  app.use(bodyParser());
  const onboarding = agentOnboarding(config);

  const registerRouter = onboarding.registerRoute();
  app.use(registerRouter.routes());
  app.use(registerRouter.allowedMethods());

  app.use(onboarding.authRequired());

  const routes = new Router();
  routes.get("/api/data", (ctx) => {
    ctx.body = { ok: true };
  });
  routes.get("/llms.txt", (ctx) => {
    ctx.body = "# LLMs.txt";
  });
  routes.get("/.well-known/agent.json", (ctx) => {
    ctx.body = { name: "test" };
  });
  app.use(routes.routes());
  app.use(routes.allowedMethods());

  return app;
}

describe("agentOnboarding middleware (Koa)", () => {
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
    const res = await request(app.callback())
      .post("/agent/register")
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("provisioned");
  });

  it("returns 400 for missing agent_id", async () => {
    const app = createApp();
    const res = await request(app.callback())
      .post("/agent/register")
      .send({ agent_name: "Bot", agent_provider: "openai" });

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
    const cb = app.callback();

    await request(cb).post("/agent/register").send(validBody);
    await request(cb).post("/agent/register").send(validBody);
    const res = await request(cb).post("/agent/register").send(validBody);

    expect(res.status).toBe(429);
  });

  it("returns 401 for unauthenticated request", async () => {
    const app = createApp();
    const res = await request(app.callback()).get("/api/data");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("auth_required");
  });

  it("passes through with Authorization header", async () => {
    const app = createApp();
    const res = await request(app.callback())
      .get("/api/data")
      .set("Authorization", "Bearer sk-test");
    expect(res.status).toBe(200);
  });

  it("does not block /llms.txt", async () => {
    const app = createApp();
    const res = await request(app.callback()).get("/llms.txt");
    expect(res.status).toBe(200);
  });

  it("does not block /.well-known/ paths", async () => {
    const app = createApp();
    const res = await request(app.callback()).get("/.well-known/agent.json");
    expect(res.status).toBe(200);
  });

  it("returns 403 for disallowed provider", async () => {
    const config: OnboardingConfig = {
      ...baseConfig,
      allowedProviders: ["anthropic"],
    };
    const app = createApp(config);
    const res = await request(app.callback())
      .post("/agent/register")
      .send(validBody);
    expect(res.status).toBe(403);
  });

  it("returns 502 when webhook fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    const app = createApp();
    const res = await request(app.callback())
      .post("/agent/register")
      .send(validBody);
    expect(res.status).toBe(502);
  });
});
