import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";
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

async function createApp(cfg: UnifiedDiscoveryConfig = config) {
  const fastify = Fastify();
  await fastify.register(unifiedDiscovery(cfg));
  return fastify;
}

describe("unifiedDiscovery Fastify plugin", () => {
  let fastify: Awaited<ReturnType<typeof createApp>>;

  afterEach(async () => {
    if (fastify) await fastify.close();
  });

  it("serves /.well-known/ai as JSON", async () => {
    fastify = await createApp();
    const res = await fastify.inject({ method: "GET", url: "/.well-known/ai" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("Test API");
    expect(body.description).toBe("A test API");
    expect(body.llms_txt_url).toBe("https://test.example.com/llms.txt");
  });

  it("serves /.well-known/agent.json as A2A Agent Card", async () => {
    fastify = await createApp();
    const res = await fastify.inject({ method: "GET", url: "/.well-known/agent.json" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("Test API");
    expect(body.protocolVersion).toBe("1.0.0");
    expect(body.skills).toHaveLength(1);
    expect(body.authentication.type).toBe("apiKey");
  });

  it("serves /agents.txt as text", async () => {
    fastify = await createApp();
    const res = await fastify.inject({ method: "GET", url: "/agents.txt" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("User-agent: *");
    expect(res.body).toContain("Allow: /api/*");
  });

  it("serves /llms.txt as text", async () => {
    fastify = await createApp();
    const res = await fastify.inject({ method: "GET", url: "/llms.txt" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("# Test API");
    expect(res.body).toContain("## Greeting");
  });

  it("respects disabled formats", async () => {
    fastify = await createApp({
      ...config,
      formats: { agentsTxt: false, llmsTxt: false },
    });

    expect((await fastify.inject({ method: "GET", url: "/.well-known/ai" })).statusCode).toBe(200);
    expect((await fastify.inject({ method: "GET", url: "/.well-known/agent.json" })).statusCode).toBe(200);
    expect((await fastify.inject({ method: "GET", url: "/agents.txt" })).statusCode).toBe(404);
    expect((await fastify.inject({ method: "GET", url: "/llms.txt" })).statusCode).toBe(404);
  });
});
