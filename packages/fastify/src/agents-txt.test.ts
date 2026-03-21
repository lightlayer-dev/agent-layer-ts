import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { agentsTxtRoutes } from "./agents-txt.js";

describe("agentsTxtRoutes (Fastify)", () => {
  describe("GET /agents.txt", () => {
    it("serves agents.txt as text/plain", async () => {
      const app = Fastify();
      await app.register(
        agentsTxtRoutes({
          rules: [{ agent: "*", allow: ["/api/*"] }],
          siteName: "Test API",
        }),
      );

      const res = await app.inject({ method: "GET", url: "/agents.txt" });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.body).toContain("User-agent: *");
      expect(res.body).toContain("Allow: /api/*");
      expect(res.body).toContain("# Site: Test API");
    });

    it("sets cache-control header", async () => {
      const app = Fastify();
      await app.register(agentsTxtRoutes({ rules: [{ agent: "*" }] }));

      const res = await app.inject({ method: "GET", url: "/agents.txt" });

      expect(res.headers["cache-control"]).toBe("public, max-age=3600");
    });
  });

  describe("enforcement", () => {
    it("does not enforce when enforce is false", async () => {
      const app = Fastify();
      await app.register(
        agentsTxtRoutes({
          rules: [{ agent: "*", deny: ["/*"] }],
          enforce: false,
        }),
      );
      app.get("/api/test", async () => ({ ok: true }));

      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { "user-agent": "TestBot" },
      });

      expect(res.statusCode).toBe(200);
    });

    it("allows permitted agents", async () => {
      const app = Fastify();
      await app.register(
        agentsTxtRoutes({
          rules: [{ agent: "*", allow: ["/api/*"] }],
          enforce: true,
        }),
      );
      app.get("/api/test", async () => ({ ok: true }));

      const res = await app.inject({
        method: "GET",
        url: "/api/test",
        headers: { "user-agent": "TestBot" },
      });

      expect(res.statusCode).toBe(200);
    });

    it("returns 403 for denied agents", async () => {
      const app = Fastify();
      await app.register(
        agentsTxtRoutes({
          rules: [{ agent: "*", deny: ["/api/admin/*"] }],
          enforce: true,
        }),
      );
      app.get("/api/admin/settings", async () => ({ ok: true }));

      const res = await app.inject({
        method: "GET",
        url: "/api/admin/settings",
        headers: { "user-agent": "TestBot" },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error.code).toBe("agent_denied");
      expect(body.error.docs_url).toBe("/agents.txt");
    });
  });
});
