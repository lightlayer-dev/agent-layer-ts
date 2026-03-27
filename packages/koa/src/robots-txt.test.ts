import { describe, it, expect } from "vitest";
import Koa from "koa";
import Router from "@koa/router";
import request from "supertest";
import { robotsTxtRoutes } from "./robots-txt.js";

describe("robotsTxtRoutes (Koa)", () => {
  it("serves /robots.txt as text/plain", async () => {
    const app = new Koa();
    const router = new Router();
    const handlers = robotsTxtRoutes();
    router.get("/robots.txt", handlers.robotsTxt);
    app.use(router.routes());

    const res = await request(app.callback()).get("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("User-agent: *");
  });

  it("includes AI agent rules by default", async () => {
    const app = new Koa();
    const router = new Router();
    const handlers = robotsTxtRoutes();
    router.get("/robots.txt", handlers.robotsTxt);
    app.use(router.routes());

    const res = await request(app.callback()).get("/robots.txt");
    expect(res.text).toContain("User-agent: GPTBot");
    expect(res.text).toContain("User-agent: ClaudeBot");
  });

  it("supports custom config", async () => {
    const app = new Koa();
    const router = new Router();
    const handlers = robotsTxtRoutes({
      aiAllow: ["/api/"],
      aiDisallow: ["/admin/"],
      sitemaps: ["https://example.com/sitemap.xml"],
    });
    router.get("/robots.txt", handlers.robotsTxt);
    app.use(router.routes());

    const res = await request(app.callback()).get("/robots.txt");
    expect(res.text).toContain("Allow: /api/");
    expect(res.text).toContain("Disallow: /admin/");
    expect(res.text).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("sets cache-control header", async () => {
    const app = new Koa();
    const router = new Router();
    const handlers = robotsTxtRoutes();
    router.get("/robots.txt", handlers.robotsTxt);
    app.use(router.routes());

    const res = await request(app.callback()).get("/robots.txt");
    expect(res.headers["cache-control"]).toContain("public");
  });
});
