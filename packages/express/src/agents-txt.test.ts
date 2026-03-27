import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { agentsTxtRoutes } from "./agents-txt.js";

describe("agentsTxtRoutes (Express)", () => {
  describe("agentsTxt handler", () => {
    it("serves agents.txt as text/plain", async () => {
      const app = express();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", allow: ["/api/*"] }],
        siteName: "Test API",
      });
      app.get("/agents.txt", handlers.agentsTxt);

      const res = await request(app).get("/agents.txt");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("User-agent: *");
      expect(res.text).toContain("Allow: /api/*");
      expect(res.text).toContain("# Site: Test API");
    });

    it("sets cache-control header", async () => {
      const app = express();
      const handlers = agentsTxtRoutes({ rules: [{ agent: "*" }] });
      app.get("/agents.txt", handlers.agentsTxt);

      const res = await request(app).get("/agents.txt");

      expect(res.headers["cache-control"]).toBe("public, max-age=3600");
    });
  });

  describe("enforce middleware", () => {
    it("passes through when enforce is false", async () => {
      const app = express();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", deny: ["/*"] }],
        enforce: false,
      });
      app.use(handlers.enforce());
      app.get("/api/test", (_req, res) => res.json({ ok: true }));

      const res = await request(app).get("/api/test");

      expect(res.status).toBe(200);
    });

    it("passes through when agent is allowed", async () => {
      const app = express();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", allow: ["/api/*"] }],
        enforce: true,
      });
      app.use(handlers.enforce());
      app.get("/api/test", (_req, res) => res.json({ ok: true }));

      const res = await request(app)
        .get("/api/test")
        .set("User-Agent", "TestBot/1.0");

      expect(res.status).toBe(200);
    });

    it("returns 403 when agent is denied", async () => {
      const app = express();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", deny: ["/api/admin/*"] }],
        enforce: true,
      });
      app.use(handlers.enforce());
      app.get("/api/admin/settings", (_req, res) => res.json({ ok: true }));

      const res = await request(app)
        .get("/api/admin/settings")
        .set("User-Agent", "TestBot/1.0");

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("agent_denied");
    });
  });
});
