import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { unifiedDiscovery } from "./unified-discovery.js";
import type { UnifiedDiscoveryConfig } from "@agent-layer/core";

const config: UnifiedDiscoveryConfig = {
  name: "Test API",
  description: "A test API",
  url: "https://test.example.com",
  version: "1.0.0",
  provider: { organization: "Test Corp" },
  skills: [
    {
      id: "greet",
      name: "Greeting",
      description: "Says hello",
      examples: ["Hello world"],
    },
  ],
  auth: { type: "api_key", in: "header", name: "X-API-Key" },
  routes: [
    { method: "GET", path: "/api/greet", summary: "Get a greeting" },
  ],
  agentsTxt: {
    comment: "Test agent rules",
    blocks: [
      {
        userAgent: "*",
        rules: [
          { path: "/api/*", permission: "allow" },
          { path: "/internal/*", permission: "disallow" },
        ],
      },
    ],
  },
};

function createApp(cfg: UnifiedDiscoveryConfig = config) {
  const app = express();
  app.use(unifiedDiscovery(cfg).router);
  return app;
}

describe("unifiedDiscovery Express middleware", () => {
  it("serves /.well-known/ai as JSON", async () => {
    const res = await request(createApp()).get("/.well-known/ai").expect(200);
    expect(res.body.name).toBe("Test API");
    expect(res.body.description).toBe("A test API");
    expect(res.body.llms_txt_url).toBe("https://test.example.com/llms.txt");
  });

  it("serves /.well-known/agent.json as A2A Agent Card", async () => {
    const res = await request(createApp()).get("/.well-known/agent.json").expect(200);
    expect(res.body.name).toBe("Test API");
    expect(res.body.protocolVersion).toBe("1.0.0");
    expect(res.body.url).toBe("https://test.example.com");
    expect(res.body.skills).toHaveLength(1);
    expect(res.body.skills[0].id).toBe("greet");
    expect(res.body.authentication.type).toBe("apiKey");
  });

  it("serves /agents.txt as text", async () => {
    const res = await request(createApp())
      .get("/agents.txt")
      .expect(200)
      .expect("content-type", /text\/plain/);
    expect(res.text).toContain("User-agent: *");
    expect(res.text).toContain("Allow: /api/*");
    expect(res.text).toContain("Disallow: /internal/*");
  });

  it("serves /llms.txt as text", async () => {
    const res = await request(createApp())
      .get("/llms.txt")
      .expect(200)
      .expect("content-type", /text\/plain/);
    expect(res.text).toContain("# Test API");
    expect(res.text).toContain("## Greeting");
    expect(res.text).toContain("Says hello");
  });

  it("serves /llms-full.txt with route info", async () => {
    const res = await request(createApp())
      .get("/llms-full.txt")
      .expect(200)
      .expect("content-type", /text\/plain/);
    expect(res.text).toContain("## API Endpoints");
    expect(res.text).toContain("### GET /api/greet");
  });

  it("respects disabled formats", async () => {
    const app = createApp({
      ...config,
      formats: { agentsTxt: false, llmsTxt: false },
    });

    await request(app).get("/.well-known/ai").expect(200);
    await request(app).get("/.well-known/agent.json").expect(200);
    await request(app).get("/agents.txt").expect(404);
    await request(app).get("/llms.txt").expect(404);
    await request(app).get("/llms-full.txt").expect(404);
  });

  it("serves default agents.txt when no blocks configured", async () => {
    const app = createApp({ ...config, agentsTxt: undefined });
    const res = await request(app).get("/agents.txt").expect(200);
    expect(res.text).toContain("User-agent: *");
    expect(res.text).toContain("Allow: /");
  });
});
