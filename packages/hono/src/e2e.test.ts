/**
 * End-to-end tests for the Hono agentLayer() one-liner.
 * Uses Hono's built-in app.request() to test the full middleware stack.
 */
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { agentLayer } from "./index.js";

function createFullApp() {
  // Base app with user routes
  const base = new Hono();
  base.get("/api/health", (c) => c.json({ status: "ok" }));
  base.get("/api/users", (c) => c.json([{ id: 1, name: "Alice" }]));

  // Mount agent-layer as sub-app
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
    securityHeaders: {},
    errors: true,
  });

  // Mount user routes first, then agent-layer
  base.route("/", agent);
  // Re-mount user routes on the agent app so they coexist
  agent.get("/api/health", (c) => c.json({ status: "ok" }));
  agent.get("/api/users", (c) => c.json([{ id: 1, name: "Alice" }]));

  return agent;
}

describe("Hono E2E: full agentLayer stack", () => {
  const app = createFullApp();

  describe("Discovery endpoints", () => {
    it("serves /.well-known/ai with JSON manifest", async () => {
      const res = await app.request("/.well-known/ai");
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.name).toBe("Test API");
      expect(body.description).toBe("E2E test API");
    });

    it("serves /llms.txt as plain text", async () => {
      const res = await app.request("/llms.txt");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/plain");
      const text = await res.text();
      expect(text).toContain("Test API");
    });

    it("serves /llms-full.txt", async () => {
      const res = await app.request("/llms-full.txt");
      expect(res.status).toBe(200);
    });

    it("serves /.well-known/agent.json (A2A agent card)", async () => {
      const res = await app.request("/.well-known/agent.json");
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.name).toBe("Test Agent");
      expect(body.skills).toHaveLength(1);
    });

    it("serves /robots.txt with AI agent rules", async () => {
      const res = await app.request("/robots.txt");
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("User-agent: GPTBot");
      expect(text).toContain("User-agent: ClaudeBot");
      expect(text).toContain("Allow: /api/");
    });

    it("serves /agents.txt", async () => {
      const res = await app.request("/agents.txt");
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("User-agent: *");
      expect(text).toContain("Allow: /api/");
    });
  });

  describe("Rate limiting", () => {
    it("adds rate limit headers to responses", async () => {
      const res = await app.request("/llms.txt");
      expect(res.headers.get("x-ratelimit-limit")).toBe("100");
      expect(res.headers.get("x-ratelimit-remaining")).toBeDefined();
    });
  });

  describe("Structured errors", () => {
    it("returns structured JSON 404 for unknown routes", async () => {
      const res = await app.request("/nonexistent");
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBeDefined();
      expect(body.error.type).toBe("not_found_error");
    });
  });

  describe("User routes unaffected", () => {
    it("GET /api/health still works", async () => {
      const res = await app.request("/api/health");
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.status).toBe("ok");
    });

    it("GET /api/users returns data", async () => {
      const res = await app.request("/api/users");
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveLength(1);
    });
  });

  describe("Cross-feature composition", () => {
    it("rate limit headers on discovery endpoints", async () => {
      const res = await app.request("/.well-known/ai");
      expect(res.status).toBe(200);
      expect(res.headers.get("x-ratelimit-limit")).toBeDefined();
    });

    it("security headers on all responses", async () => {
      const res = await app.request("/.well-known/ai");
      expect(res.headers.get("strict-transport-security")).toContain("max-age");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("referrer-policy")).toBeDefined();
    });
  });
});

describe("Hono E2E: bare app (no agentLayer)", () => {
  const app = new Hono();
  app.get("/api/health", (c) => c.json({ status: "ok" }));

  it("has no /.well-known/ai", async () => {
    const res = await app.request("/.well-known/ai");
    expect(res.status).toBe(404);
  });

  it("has no /llms.txt", async () => {
    const res = await app.request("/llms.txt");
    expect(res.status).toBe(404);
  });

  it("has no /agents.txt", async () => {
    const res = await app.request("/agents.txt");
    expect(res.status).toBe(404);
  });

  it("has no rate limit headers", async () => {
    const res = await app.request("/api/health");
    expect(res.headers.get("x-ratelimit-limit")).toBeNull();
  });
});
