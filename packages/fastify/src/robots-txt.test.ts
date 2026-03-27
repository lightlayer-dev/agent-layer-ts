import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { robotsTxtRoutes } from "./robots-txt.js";

describe("robotsTxtRoutes (Fastify)", () => {
  it("serves /robots.txt as text/plain", async () => {
    const app = Fastify();
    await app.register(robotsTxtRoutes());

    const res = await app.inject({ method: "GET", url: "/robots.txt" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("User-agent: *");
  });

  it("includes AI agent rules by default", async () => {
    const app = Fastify();
    await app.register(robotsTxtRoutes());

    const res = await app.inject({ method: "GET", url: "/robots.txt" });
    expect(res.body).toContain("User-agent: GPTBot");
    expect(res.body).toContain("User-agent: ClaudeBot");
  });

  it("supports custom config", async () => {
    const app = Fastify();
    await app.register(robotsTxtRoutes({
      aiAllow: ["/api/"],
      aiDisallow: ["/admin/"],
      sitemaps: ["https://example.com/sitemap.xml"],
    }));

    const res = await app.inject({ method: "GET", url: "/robots.txt" });
    expect(res.body).toContain("Allow: /api/");
    expect(res.body).toContain("Disallow: /admin/");
    expect(res.body).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("sets cache-control header", async () => {
    const app = Fastify();
    await app.register(robotsTxtRoutes());

    const res = await app.inject({ method: "GET", url: "/robots.txt" });
    expect(res.headers["cache-control"]).toContain("public");
  });
});
