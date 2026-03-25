/**
 * End-to-end tests for the Express agentLayer() one-liner.
 * Spins up a real Express server with the full middleware stack
 * and verifies every agent-facing feature works together.
 */
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { agentLayer } from "./index.js";

function createFullApp() {
  const app = express();

  // User routes (before agentLayer)
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/users", (_req, res) => res.json([{ id: 1, name: "Alice" }]));
  app.post("/api/users", express.json(), (req, res) =>
    res.status(201).json({ id: 2, ...req.body }),
  );

  // Mount the full agent-layer stack
  app.use(
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
        rules: [
          { agent: "*", allow: ["/api/"], deny: ["/admin/"] },
        ],
      },
      errors: true,
    }),
  );

  return app;
}

describe("Express E2E: full agentLayer stack", () => {
  const app = createFullApp();

  // ── Discovery ─────────────────────────────────────────────────────

  describe("Discovery endpoints", () => {
    it("serves /.well-known/ai with JSON manifest", async () => {
      const res = await request(app).get("/.well-known/ai");
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test API");
      expect(res.body.description).toBe("E2E test API");
    });

    it("serves /llms.txt as plain text", async () => {
      const res = await request(app).get("/llms.txt");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("Test API");
      expect(res.text).toContain("testing agent-layer");
    });

    it("serves /llms-full.txt", async () => {
      const res = await request(app).get("/llms-full.txt");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
    });

    it("serves /.well-known/agent.json (A2A agent card)", async () => {
      const res = await request(app).get("/.well-known/agent.json");
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test Agent");
      expect(res.body.skills).toHaveLength(1);
      expect(res.body.skills[0].id).toBe("echo");
    });

    it("serves /agents.txt", async () => {
      const res = await request(app).get("/agents.txt");
      expect(res.status).toBe(200);
      expect(res.text).toContain("User-agent: *");
      expect(res.text).toContain("Allow: /api/");
      expect(res.text).toContain("Deny: /admin/");
    });
  });

  // ── Rate Limiting ─────────────────────────────────────────────────

  describe("Rate limiting", () => {
    it("adds rate limit headers to responses", async () => {
      const res = await request(app).get("/llms.txt");
      expect(res.headers["x-ratelimit-limit"]).toBe("100");
      expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
    });
  });

  // ── Structured Errors ─────────────────────────────────────────────

  describe("Structured error responses", () => {
    it("returns structured JSON 404 for unknown routes", async () => {
      const res = await request(app)
        .get("/nonexistent")
        .set("Accept", "application/json");
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.type).toBe("not_found_error");
      expect(res.body.error.is_retriable).toBe(false);
    });
  });

  // ── User routes still work ────────────────────────────────────────

  describe("User routes unaffected", () => {
    it("GET /api/health still works", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("GET /api/users returns data", async () => {
      const res = await request(app).get("/api/users");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("POST /api/users creates a user", async () => {
      const res = await request(app)
        .post("/api/users")
        .send({ name: "Bob" })
        .set("Content-Type", "application/json");
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Bob");
    });
  });

  // ── Cross-feature: everything composes ────────────────────────────

  describe("Cross-feature composition", () => {
    it("rate limit headers appear on discovery endpoints", async () => {
      const res = await request(app).get("/.well-known/ai");
      expect(res.status).toBe(200);
      expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    });

    it("404 errors have rate limit headers too", async () => {
      const res = await request(app)
        .get("/nope")
        .set("Accept", "application/json");
      expect(res.status).toBe(404);
      // Rate limit headers should be on all responses
      expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    });
  });
});

describe("Express E2E: bare app (no agentLayer)", () => {
  const app = express();
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  it("has no /.well-known/ai", async () => {
    const res = await request(app).get("/.well-known/ai");
    expect(res.status).toBe(404);
  });

  it("has no /llms.txt", async () => {
    const res = await request(app).get("/llms.txt");
    expect(res.status).toBe(404);
  });

  it("has no /agents.txt", async () => {
    const res = await request(app).get("/agents.txt");
    expect(res.status).toBe(404);
  });

  it("has no /.well-known/agent.json", async () => {
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.status).toBe(404);
  });

  it("has no rate limit headers", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
  });
});
