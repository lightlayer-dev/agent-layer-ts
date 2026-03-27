import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { robotsTxtRoutes } from "./robots-txt.js";

describe("robotsTxtRoutes (Express)", () => {
  it("serves /robots.txt as text/plain", async () => {
    const app = express();
    const handlers = robotsTxtRoutes();
    app.get("/robots.txt", handlers.robotsTxt);

    const res = await request(app).get("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("User-agent: *");
  });

  it("includes AI agent rules by default", async () => {
    const app = express();
    const handlers = robotsTxtRoutes();
    app.get("/robots.txt", handlers.robotsTxt);

    const res = await request(app).get("/robots.txt");
    expect(res.text).toContain("User-agent: GPTBot");
    expect(res.text).toContain("User-agent: ClaudeBot");
  });

  it("supports custom config", async () => {
    const app = express();
    const handlers = robotsTxtRoutes({
      aiAllow: ["/api/"],
      aiDisallow: ["/admin/"],
      sitemaps: ["https://example.com/sitemap.xml"],
    });
    app.get("/robots.txt", handlers.robotsTxt);

    const res = await request(app).get("/robots.txt");
    expect(res.text).toContain("Allow: /api/");
    expect(res.text).toContain("Disallow: /admin/");
    expect(res.text).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("sets cache-control header", async () => {
    const app = express();
    const handlers = robotsTxtRoutes();
    app.get("/robots.txt", handlers.robotsTxt);

    const res = await request(app).get("/robots.txt");
    expect(res.headers["cache-control"]).toContain("public");
  });
});
