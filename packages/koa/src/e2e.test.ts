/**
 * End-to-end tests for the Koa agentLayer() one-liner.
 * Uses supertest with a real Koa app to test the full middleware stack.
 */
import { describe, it, expect } from "vitest";
import Koa from "koa";
import Router from "@koa/router";
import request from "supertest";
import { agentLayer } from "./index.js";

function createFullApp() {
  const app = new Koa();

  // User routes
  const userRouter = new Router();
  userRouter.get("/api/health", (ctx) => {
    ctx.body = { status: "ok" };
  });
  userRouter.get("/api/users", (ctx) => {
    ctx.body = [{ id: 1, name: "Alice" }];
  });

  // Agent layer
  const agent = agentLayer({
    rateLimit: { max: 100, windowMs: 60_000 },
    llmsTxt: {
      title: "Test API",
      description: "An API for testing agent-layer features end-to-end.",
    },
    discovery: {
      manifest: {
        name: "Test API",
        description: "E2E test API",
        version: "1.0.0",
      },
    },
    a2a: {
      card: {
        name: "Test Agent",
        description: "E2E test agent",
        url: "https://test.example.com",
        capabilities: { streaming: false, pushNotifications: false },
        skills: [{ id: "echo", name: "Echo", description: "Echoes input" }],
      },
    },
    agentsTxt: {
      rules: [{ agent: "*", allow: ["/api/"], deny: ["/admin/"] }],
    },
    robotsTxt: {
      aiAllow: ["/api/"],
      aiDisallow: ["/admin/"],
      sitemaps: ["https://test.example.com/sitemap.xml"],
    },
    securityHeaders: {
    },
    errors: true,
  });

  app.use(agent.routes());
  app.use(agent.allowedMethods());
  app.use(userRouter.routes());
  app.use(userRouter.allowedMethods());

  return app;
}

describe("Koa E2E: full agentLayer stack", () => {
  const app = createFullApp();
  const server = app.callback();

  describe("Discovery endpoints", () => {
    it("serves /.well-known/ai with JSON manifest", async () => {
      const res = await request(server).get("/.well-known/ai");
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test API");
      expect(res.body.description).toBe("E2E test API");
    });

    it("serves /llms.txt as plain text", async () => {
      const res = await request(server).get("/llms.txt");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("Test API");
    });

    it("serves /.well-known/agent.json (A2A agent card)", async () => {
      const res = await request(server).get("/.well-known/agent.json");
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test Agent");
      expect(res.body.skills).toHaveLength(1);
    });

    it("serves /robots.txt with AI agent rules", async () => {
      const res = await request(server).get("/robots.txt");
      expect(res.status).toBe(200);
      expect(res.text).toContain("User-agent: GPTBot");
      expect(res.text).toContain("User-agent: ClaudeBot");
      expect(res.text).toContain("Allow: /api/");
    });

    it("serves /agents.txt", async () => {
      const res = await request(server).get("/agents.txt");
      expect(res.status).toBe(200);
      expect(res.text).toContain("User-agent: *");
      expect(res.text).toContain("Allow: /api/");
    });
  });

  describe("Rate limiting", () => {
    it("adds rate limit headers to responses", async () => {
      const res = await request(server).get("/llms.txt");
      expect(res.headers["x-ratelimit-limit"]).toBe("100");
      expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
    });
  });

  describe("User routes unaffected", () => {
    it("GET /api/health still works", async () => {
      const res = await request(server).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("GET /api/users returns data", async () => {
      const res = await request(server).get("/api/users");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });
});
