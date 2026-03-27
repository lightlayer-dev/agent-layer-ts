import { describe, it, expect } from "vitest";
import Koa from "koa";
import request from "supertest";
import { agentLayer } from "./index.js";
import { agentErrors, notFoundHandler } from "./agent-errors.js";
import { rateLimits } from "./rate-limits.js";
import { llmsTxtRoutes } from "./llms-txt.js";
import { discoveryRoutes } from "./discovery.js";

describe("Integration: agentErrors (Koa)", () => {
  it("returns structured JSON 404 for unknown routes", async () => {
    const app = new Koa();
    const Router = (await import("@koa/router")).default;
    const router = new Router();
    router.get("/exists", (ctx) => { ctx.body = { ok: true }; });
    app.use(router.routes());
    app.use(notFoundHandler());
    app.use(agentErrors());

    const res = await request(app.callback())
      .get("/does-not-exist")
      .set("Accept", "application/json");

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.type).toBe("not_found_error");
    expect(res.body.error.is_retriable).toBe(false);
  });

  it("returns structured error for thrown exceptions", async () => {
    const app = new Koa();
    const Router = (await import("@koa/router")).default;
    const router = new Router();
    router.get("/fail", () => {
      throw new Error("Something broke");
    });
    app.use(agentErrors());
    app.use(router.routes());

    const res = await request(app.callback())
      .get("/fail")
      .set("Accept", "application/json");

    expect(res.status).toBe(500);
    expect(res.body.error.type).toBe("api_error");
    expect(res.body.error.message).toContain("Something broke");
  });

  it("preserves successful responses", async () => {
    const app = new Koa();
    const Router = (await import("@koa/router")).default;
    const router = new Router();
    router.get("/ok", (ctx) => { ctx.body = { status: "healthy" }; });
    app.use(router.routes());
    app.use(agentErrors());

    const res = await request(app.callback()).get("/ok");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });
});

describe("Integration: rateLimits (Koa)", () => {
  it("adds rate limit headers to every response", async () => {
    const app = new Koa();
    app.use(rateLimits({ max: 50, windowMs: 60000 }));
    app.use((ctx) => { ctx.body = { ok: true }; });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["x-ratelimit-limit"]).toBe("50");
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
  });

  it("returns 429 when rate limit exceeded", async () => {
    const app = new Koa();
    app.use(rateLimits({ max: 2, windowMs: 60000 }));
    app.use((ctx) => { ctx.body = { ok: true }; });

    const server = app.callback();
    await request(server).get("/"); // 1
    await request(server).get("/"); // 2
    const res = await request(server).get("/"); // 3 — should be blocked

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
  });
});

describe("Integration: llmsTxt (Koa)", () => {
  it("serves /llms.txt with manual content", async () => {
    const app = new Koa();
    const Router = (await import("@koa/router")).default;
    const router = new Router();
    const handlers = llmsTxtRoutes({ title: "My App", description: "A test application." });
    router.get("/llms.txt", handlers.llmsTxt);
    app.use(router.routes());

    const res = await request(app.callback()).get("/llms.txt");
    expect(res.status).toBe(200);
    expect(res.text).toContain("My App");
    expect(res.headers["content-type"]).toContain("text/plain");
  });

  it("returns 404 for /llms.txt when no route configured", async () => {
    const app = new Koa();
    const Router = (await import("@koa/router")).default;
    const router = new Router();
    router.get("/other", (ctx) => { ctx.body = "ok"; });
    app.use(router.routes());

    const res = await request(app.callback()).get("/llms.txt");
    expect(res.status).toBe(404);
  });
});

describe("Integration: discovery (Koa)", () => {
  it("serves /.well-known/ai manifest", async () => {
    const app = new Koa();
    const Router = (await import("@koa/router")).default;
    const router = new Router();
    const handlers = discoveryRoutes({
      manifest: { name: "Test API", description: "A test API" },
    });
    router.get("/.well-known/ai", handlers.wellKnownAi);
    app.use(router.routes());

    const res = await request(app.callback()).get("/.well-known/ai");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Test API");
  });
});

describe("Integration: agentLayer one-liner (Koa)", () => {
  it("composes all middleware", async () => {
    const app = new Koa();
    const layerRouter = agentLayer({
      rateLimit: { max: 100, windowMs: 60000 },
      llmsTxt: { title: "Test" },
      discovery: { manifest: { name: "Test", description: "Test app" } },
      errors: false,
    });
    app.use(layerRouter.routes());
    app.use(layerRouter.allowedMethods());

    // llms.txt works
    const llms = await request(app.callback()).get("/llms.txt");
    expect(llms.status).toBe(200);
    expect(llms.text).toContain("Test");

    // discovery works
    const ai = await request(app.callback()).get("/.well-known/ai");
    expect(ai.status).toBe(200);

    // rate limit headers present
    expect(llms.headers["x-ratelimit-limit"]).toBe("100");
  });
});
