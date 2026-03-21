import { describe, it, expect } from "vitest";
import { Hono } from "hono";
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
  const app = new Hono();
  app.route("/", unifiedDiscovery(cfg).app);
  return app;
}

describe("unifiedDiscovery Hono middleware", () => {
  it("serves /.well-known/ai as JSON", async () => {
    const res = await createApp().request("/.well-known/ai");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Test API");
    expect(body.description).toBe("A test API");
    expect(body.llms_txt_url).toBe("https://test.example.com/llms.txt");
  });

  it("serves /.well-known/agent.json as A2A Agent Card", async () => {
    const res = await createApp().request("/.well-known/agent.json");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Test API");
    expect(body.protocolVersion).toBe("1.0.0");
    expect(body.url).toBe("https://test.example.com");
    expect(body.skills).toHaveLength(1);
    expect(body.skills[0].id).toBe("greet");
    expect(body.authentication.type).toBe("apiKey");
  });

  it("serves /agents.txt as text", async () => {
    const res = await createApp().request("/agents.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /api/*");
    expect(text).toContain("Disallow: /internal/*");
  });

  it("serves /llms.txt as text", async () => {
    const res = await createApp().request("/llms.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("# Test API");
    expect(text).toContain("## Greeting");
  });

  it("respects disabled formats", async () => {
    const app = createApp({
      ...config,
      formats: { agentsTxt: false, llmsTxt: false },
    });

    expect((await app.request("/.well-known/ai")).status).toBe(200);
    expect((await app.request("/.well-known/agent.json")).status).toBe(200);
    expect((await app.request("/agents.txt")).status).toBe(404);
    expect((await app.request("/llms.txt")).status).toBe(404);
  });
});
