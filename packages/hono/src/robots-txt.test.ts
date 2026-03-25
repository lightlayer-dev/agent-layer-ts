import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { robotsTxtRoutes } from "./robots-txt.js";

describe("robotsTxtRoutes (Hono)", () => {
  it("serves /robots.txt as text/plain", async () => {
    const app = new Hono();
    const handlers = robotsTxtRoutes();
    app.get("/robots.txt", (c) => handlers.robotsTxt(c));

    const res = await app.request("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("User-agent: *");
  });

  it("includes AI agent rules by default", async () => {
    const app = new Hono();
    const handlers = robotsTxtRoutes();
    app.get("/robots.txt", (c) => handlers.robotsTxt(c));

    const res = await app.request("/robots.txt");
    const text = await res.text();
    expect(text).toContain("User-agent: GPTBot");
    expect(text).toContain("User-agent: ClaudeBot");
  });

  it("supports custom config", async () => {
    const app = new Hono();
    const handlers = robotsTxtRoutes({
      aiAllow: ["/api/"],
      aiDisallow: ["/admin/"],
      sitemaps: ["https://example.com/sitemap.xml"],
    });
    app.get("/robots.txt", (c) => handlers.robotsTxt(c));

    const res = await app.request("/robots.txt");
    const text = await res.text();
    expect(text).toContain("Allow: /api/");
    expect(text).toContain("Disallow: /admin/");
    expect(text).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("sets cache-control header", async () => {
    const app = new Hono();
    const handlers = robotsTxtRoutes();
    app.get("/robots.txt", (c) => handlers.robotsTxt(c));

    const res = await app.request("/robots.txt");
    expect(res.headers.get("cache-control")).toContain("public");
  });
});
