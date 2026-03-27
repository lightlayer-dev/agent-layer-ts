import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { agentLayer } from "./index.js";
import { agentErrors, notFoundHandler } from "./agent-errors.js";
import { rateLimits } from "./rate-limits.js";
import { llmsTxtRoutes } from "./llms-txt.js";
import { discoveryRoutes } from "./discovery.js";

describe("Integration: agentErrors (Hono)", () => {
  it("returns structured JSON 404 for unknown routes", async () => {
    const app = new Hono();
    app.get("/exists", (c) => c.json({ ok: true }));
    app.onError(agentErrors());
    app.notFound(notFoundHandler());

    const res = await app.request("/does-not-exist", {
      headers: { accept: "application/json" },
    });

    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error).toBeDefined();
    expect(body.error.type).toBe("not_found_error");
    expect(body.error.is_retriable).toBe(false);
  });

  it("returns structured error for thrown exceptions", async () => {
    const app = new Hono();
    app.onError(agentErrors());
    app.get("/fail", () => {
      throw new Error("Something broke");
    });

    const res = await app.request("/fail", {
      headers: { accept: "application/json" },
    });

    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error.type).toBe("api_error");
    expect(body.error.message).toContain("Something broke");
  });

  it("preserves successful responses", async () => {
    const app = new Hono();
    app.onError(agentErrors());
    app.get("/ok", (c) => c.json({ status: "healthy" }));

    const res = await app.request("/ok");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe("healthy");
  });
});

describe("Integration: rateLimits (Hono)", () => {
  it("adds rate limit headers to every response", async () => {
    const app = new Hono();
    app.use("*", rateLimits({ max: 50, windowMs: 60000 }));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-ratelimit-limit")).toBe("50");
    expect(res.headers.get("x-ratelimit-remaining")).toBeDefined();
  });

  it("returns 429 when rate limit exceeded", async () => {
    const app = new Hono();
    app.use("*", rateLimits({ max: 2, windowMs: 60000 }));
    app.get("/", (c) => c.json({ ok: true }));

    await app.request("/"); // 1
    await app.request("/"); // 2
    const res = await app.request("/"); // 3 — should be blocked

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeDefined();
  });
});

describe("Integration: llmsTxt (Hono)", () => {
  it("serves /llms.txt with manual content", async () => {
    const app = new Hono();
    const handlers = llmsTxtRoutes({ title: "My App", description: "A test application." });
    app.get("/llms.txt", (c) => handlers.llmsTxt(c));

    const res = await app.request("/llms.txt");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("My App");
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("returns 404 for /llms.txt when no route configured", async () => {
    const app = new Hono();
    app.get("/other", (c) => c.text("ok"));

    const res = await app.request("/llms.txt");
    expect(res.status).toBe(404);
  });
});

describe("Integration: discovery (Hono)", () => {
  it("serves /.well-known/ai manifest", async () => {
    const app = new Hono();
    const handlers = discoveryRoutes({
      manifest: { name: "Test API", description: "A test API" },
    });
    app.get("/.well-known/ai", (c) => handlers.wellKnownAi(c));

    const res = await app.request("/.well-known/ai");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.name).toBe("Test API");
  });
});

describe("Integration: agentLayer one-liner (Hono)", () => {
  it("composes all middleware", async () => {
    const app = agentLayer({
      rateLimit: { max: 100, windowMs: 60000 },
      llmsTxt: { title: "Test" },
      discovery: { manifest: { name: "Test", description: "Test app" } },
      errors: false,
    });

    // llms.txt works
    const llms = await app.request("/llms.txt");
    expect(llms.status).toBe(200);
    const llmsText = await llms.text();
    expect(llmsText).toContain("Test");

    // discovery works
    const ai = await app.request("/.well-known/ai");
    expect(ai.status).toBe(200);

    // rate limit headers present
    expect(llms.headers.get("x-ratelimit-limit")).toBe("100");
  });
});
