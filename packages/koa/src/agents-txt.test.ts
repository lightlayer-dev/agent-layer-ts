import { describe, it, expect } from "vitest";
import Koa from "koa";
import Router from "@koa/router";
import request from "supertest";
import { agentsTxtRoutes } from "./agents-txt.js";

describe("agentsTxtRoutes (Koa)", () => {
  describe("agentsTxt handler", () => {
    it("serves agents.txt as text/plain", async () => {
      const app = new Koa();
      const router = new Router();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", allow: ["/api/*"] }],
        siteName: "Test API",
      });
      router.get("/agents.txt", (ctx) => handlers.agentsTxt(ctx));
      app.use(router.routes());

      const res = await request(app.callback()).get("/agents.txt");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("User-agent: *");
      expect(res.text).toContain("Allow: /api/*");
      expect(res.text).toContain("# Site: Test API");
    });

    it("sets cache-control header", async () => {
      const app = new Koa();
      const router = new Router();
      const handlers = agentsTxtRoutes({ rules: [{ agent: "*" }] });
      router.get("/agents.txt", (ctx) => handlers.agentsTxt(ctx));
      app.use(router.routes());

      const res = await request(app.callback()).get("/agents.txt");

      expect(res.headers["cache-control"]).toBe("public, max-age=3600");
    });
  });

  describe("enforce middleware", () => {
    it("passes through when enforce is false", async () => {
      const app = new Koa();
      const router = new Router();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", deny: ["/*"] }],
        enforce: false,
      });
      app.use(handlers.enforce);
      router.get("/api/test", (ctx) => { ctx.body = { ok: true }; });
      app.use(router.routes());

      const res = await request(app.callback()).get("/api/test");

      expect(res.status).toBe(200);
    });

    it("passes through when agent is allowed", async () => {
      const app = new Koa();
      const router = new Router();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", allow: ["/api/*"] }],
        enforce: true,
      });
      app.use(handlers.enforce);
      router.get("/api/test", (ctx) => { ctx.body = { ok: true }; });
      app.use(router.routes());

      const res = await request(app.callback())
        .get("/api/test")
        .set("User-Agent", "TestBot/1.0");

      expect(res.status).toBe(200);
    });

    it("returns 403 when agent is denied", async () => {
      const app = new Koa();
      const router = new Router();
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", deny: ["/api/admin/*"] }],
        enforce: true,
      });
      app.use(handlers.enforce);
      router.get("/api/admin/settings", (ctx) => { ctx.body = { ok: true }; });
      app.use(router.routes());

      const res = await request(app.callback())
        .get("/api/admin/settings")
        .set("User-Agent", "TestBot/1.0");

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("agent_denied");
    });
  });
});
