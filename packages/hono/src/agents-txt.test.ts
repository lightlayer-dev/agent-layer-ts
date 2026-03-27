import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { agentsTxtRoutes } from "./agents-txt.js";

describe("agentsTxtRoutes (Hono)", () => {
  describe("agentsTxt handler", () => {
    it("serves agents.txt as text/plain", async () => {
      const app = new Hono();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", allow: ["/api/*"] }],
        siteName: "Test API",
      });
      app.get("/agents.txt", (c) => handlers.agentsTxt(c));

      const res = await app.request("/agents.txt");

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/plain");
      const body = await res.text();
      expect(body).toContain("User-agent: *");
      expect(body).toContain("Allow: /api/*");
      expect(body).toContain("# Site: Test API");
    });

    it("sets cache-control header", async () => {
      const app = new Hono();
      const handlers = agentsTxtRoutes({ rules: [{ agent: "*" }] });
      app.get("/agents.txt", (c) => handlers.agentsTxt(c));

      const res = await app.request("/agents.txt");

      expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    });
  });

  describe("enforce middleware", () => {
    it("passes through when enforce is false", async () => {
      const app = new Hono();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", deny: ["/*"] }],
        enforce: false,
      });
      app.use("*", handlers.enforce);
      app.get("/api/test", (c) => c.json({ ok: true }));

      const res = await app.request("/api/test");

      expect(res.status).toBe(200);
    });

    it("passes through when agent is allowed", async () => {
      const app = new Hono();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", allow: ["/api/*"] }],
        enforce: true,
      });
      app.use("*", handlers.enforce);
      app.get("/api/test", (c) => c.json({ ok: true }));

      const res = await app.request("/api/test", {
        headers: { "user-agent": "TestBot/1.0" },
      });

      expect(res.status).toBe(200);
    });

    it("returns 403 when agent is denied", async () => {
      const app = new Hono();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", deny: ["/api/admin/*"] }],
        enforce: true,
      });
      app.use("*", handlers.enforce);
      app.get("/api/admin/settings", (c) => c.json({ ok: true }));

      const res = await app.request("/api/admin/settings", {
        headers: { "user-agent": "TestBot/1.0" },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("agent_denied");
    });
  });
});
