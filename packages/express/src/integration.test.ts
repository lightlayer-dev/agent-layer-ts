import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { agentLayer } from "./index.js";
import { agentErrors, notFoundHandler } from "./agent-errors.js";
import { rateLimits } from "./rate-limits.js";
import { llmsTxtRoutes } from "./llms-txt.js";
import { discoveryRoutes } from "./discovery.js";

describe("Integration: agentErrors", () => {
  it("returns structured JSON 404 for unknown routes", async () => {
    const app = express();
    app.get("/exists", (_req, res) => res.json({ ok: true }));
    app.use(notFoundHandler());
    app.use(agentErrors());

    const res = await request(app)
      .get("/does-not-exist")
      .set("Accept", "application/json");

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.type).toBe("not_found_error");
    expect(res.body.error.is_retriable).toBe(false);
  });

  it("returns structured error for thrown exceptions", async () => {
    const app = express();
    app.get("/fail", () => {
      throw new Error("Something broke");
    });
    app.use(agentErrors());

    const res = await request(app)
      .get("/fail")
      .set("Accept", "application/json");

    expect(res.status).toBe(500);
    expect(res.body.error.type).toBe("api_error");
    expect(res.body.error.message).toContain("Something broke");
  });

  it("preserves successful responses", async () => {
    const app = express();
    app.get("/ok", (_req, res) => res.json({ status: "healthy" }));
    app.use(agentErrors());

    const res = await request(app).get("/ok");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });
});

describe("Integration: rateLimits", () => {
  it("adds rate limit headers to every response", async () => {
    const app = express();
    app.use(rateLimits({ max: 50, windowMs: 60000 }));
    app.get("/", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["x-ratelimit-limit"]).toBe("50");
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
  });

  it("returns 429 when rate limit exceeded", async () => {
    const app = express();
    app.use(rateLimits({ max: 2, windowMs: 60000 }));
    app.get("/", (_req, res) => res.json({ ok: true }));

    await request(app).get("/"); // 1
    await request(app).get("/"); // 2
    const res = await request(app).get("/"); // 3 — should be blocked

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
  });
});

describe("Integration: llmsTxt", () => {
  it("serves /llms.txt with manual content", async () => {
    const app = express();
    const handlers = llmsTxtRoutes({ title: "My App", description: "A test application." });
    app.get("/llms.txt", handlers.llmsTxt);

    const res = await request(app).get("/llms.txt");
    expect(res.status).toBe(200);
    expect(res.text).toContain("My App");
    expect(res.headers["content-type"]).toContain("text/plain");
  });

  it("returns 404 for /llms.txt when no route configured", async () => {
    const app = express();
    app.get("/other", (_req, res) => res.send("ok"));

    const res = await request(app).get("/llms.txt");
    expect(res.status).toBe(404);
  });
});

describe("Integration: discovery", () => {
  it("serves /.well-known/ai manifest", async () => {
    const app = express();
    const handlers = discoveryRoutes({
      manifest: { name: "Test API", description: "A test API" },
    });
    app.get("/.well-known/ai", handlers.wellKnownAi);

    const res = await request(app).get("/.well-known/ai");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Test API");
  });
});

describe("Integration: agentLayer one-liner", () => {
  it("composes all middleware", async () => {
    const app = express();
    app.use(agentLayer({
      rateLimit: { max: 100, windowMs: 60000 },
      llmsTxt: { title: "Test" },
      discovery: { manifest: { name: "Test", description: "Test app" } },
      errors: false,  // Disable 404 catch-all for this test
    }));

    // llms.txt works (served by agentLayer router)
    const llms = await request(app).get("/llms.txt");
    expect(llms.status).toBe(200);
    expect(llms.text).toContain("Test");

    // discovery works
    const ai = await request(app).get("/.well-known/ai");
    expect(ai.status).toBe(200);

    // rate limit headers present on routes served by agentLayer
    expect(llms.headers["x-ratelimit-limit"]).toBe("100");
  });
});
