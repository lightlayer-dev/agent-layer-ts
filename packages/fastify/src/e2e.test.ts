/**
 * End-to-end tests for the Fastify agentLayer() plugin.
 * Uses Fastify's built-in inject() for real request simulation.
 */
import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { agentLayer } from "./index.js";

async function createFullApp() {
  const app = Fastify();

  // User routes
  app.get("/api/health", async () => ({ status: "ok" }));
  app.get("/api/users", async () => [{ id: 1, name: "Alice" }]);

  // Register the full agent-layer stack
  await app.register(
    agentLayer({
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
      securityHeaders: {},
      errors: true,
    }),
  );

  return app;
}

describe("Fastify E2E: full agentLayer stack", () => {
  describe("Discovery endpoints", () => {
    it("serves /.well-known/ai with JSON manifest", async () => {
      const app = await createFullApp();
      const res = await app.inject({ method: "GET", url: "/.well-known/ai" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.name).toBe("Test API");
      expect(body.description).toBe("E2E test API");
    });

    it("serves /llms.txt as plain text", async () => {
      const app = await createFullApp();
      const res = await app.inject({ method: "GET", url: "/llms.txt" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.body).toContain("Test API");
    });

    it("serves /.well-known/agent.json (A2A agent card)", async () => {
      const app = await createFullApp();
      const res = await app.inject({
        method: "GET",
        url: "/.well-known/agent.json",
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.name).toBe("Test Agent");
      expect(body.skills).toHaveLength(1);
    });

    it("serves /robots.txt with AI agent rules", async () => {
      const app = await createFullApp();
      const res = await app.inject({ method: "GET", url: "/robots.txt" });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("User-agent: GPTBot");
      expect(res.body).toContain("User-agent: ClaudeBot");
      expect(res.body).toContain("Allow: /api/");
    });

    it("serves /agents.txt", async () => {
      const app = await createFullApp();
      const res = await app.inject({ method: "GET", url: "/agents.txt" });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("User-agent: *");
      expect(res.body).toContain("Allow: /api/");
    });
  });

  describe("Rate limiting", () => {
    it("adds rate limit headers to responses", async () => {
      const app = await createFullApp();
      const res = await app.inject({ method: "GET", url: "/llms.txt" });
      expect(res.headers["x-ratelimit-limit"]).toBe("100");
      expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
    });
  });

  describe("Structured errors", () => {
    it("returns structured JSON 404 for unknown routes", async () => {
      const app = await createFullApp();
      const res = await app.inject({
        method: "GET",
        url: "/nonexistent",
        headers: { accept: "application/json" },
      });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error).toBeDefined();
      expect(body.error.type).toBe("not_found_error");
    });
  });

  describe("User routes unaffected", () => {
    it("GET /api/health still works", async () => {
      const app = await createFullApp();
      const res = await app.inject({ method: "GET", url: "/api/health" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "ok" });
    });

    it("GET /api/users returns data", async () => {
      const app = await createFullApp();
      const res = await app.inject({ method: "GET", url: "/api/users" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });
  });

  describe("Cross-feature composition", () => {
    it("rate limit headers on discovery endpoints", async () => {
      const app = await createFullApp();
      const res = await app.inject({ method: "GET", url: "/.well-known/ai" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    });

    it("security headers on all responses", async () => {
      const app = await createFullApp();
      const res = await app.inject({ method: "GET", url: "/.well-known/ai" });
      expect(res.headers["strict-transport-security"]).toContain("max-age");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["referrer-policy"]).toBeDefined();
    });
  });
});
