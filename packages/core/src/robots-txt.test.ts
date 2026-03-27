import { describe, it, expect } from "vitest";
import { generateRobotsTxt, AI_AGENTS } from "./robots-txt.js";

describe("generateRobotsTxt", () => {
  it("generates default with AI agent rules", () => {
    const txt = generateRobotsTxt();
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("User-agent: GPTBot");
    expect(txt).toContain("User-agent: ClaudeBot");
    expect(txt).toContain("User-agent: Google-Extended");
    expect(txt).toContain("Allow: /");
  });

  it("includes all known AI agents by default", () => {
    const txt = generateRobotsTxt();
    for (const agent of AI_AGENTS) {
      expect(txt).toContain(`User-agent: ${agent}`);
    }
  });

  it("supports disallow policy for AI agents", () => {
    const txt = generateRobotsTxt({ aiAgentPolicy: "disallow" });
    expect(txt).toContain("User-agent: GPTBot");
    expect(txt).toContain("Disallow: /");
  });

  it("supports custom AI allow/disallow paths", () => {
    const txt = generateRobotsTxt({
      aiAllow: ["/api/"],
      aiDisallow: ["/admin/", "/private/"],
    });
    expect(txt).toContain("Allow: /api/");
    expect(txt).toContain("Disallow: /admin/");
    expect(txt).toContain("Disallow: /private/");
  });

  it("supports explicit rules", () => {
    const txt = generateRobotsTxt({
      rules: [
        { userAgent: "*", allow: ["/"], disallow: ["/admin"] },
        { userAgent: "BadBot", disallow: ["/"] },
      ],
    });
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("User-agent: BadBot");
    expect(txt).toContain("Disallow: /admin");
  });

  it("includes sitemaps", () => {
    const txt = generateRobotsTxt({
      sitemaps: ["https://example.com/sitemap.xml"],
    });
    expect(txt).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("can skip AI agent rules", () => {
    const txt = generateRobotsTxt({ includeAiAgents: false });
    expect(txt).not.toContain("GPTBot");
    expect(txt).toContain("User-agent: *");
  });

  it("supports crawl-delay", () => {
    const txt = generateRobotsTxt({
      rules: [{ userAgent: "*", allow: ["/"], crawlDelay: 10 }],
    });
    expect(txt).toContain("Crawl-delay: 10");
  });

  it("ends with newline", () => {
    const txt = generateRobotsTxt();
    expect(txt.endsWith("\n")).toBe(true);
  });
});
