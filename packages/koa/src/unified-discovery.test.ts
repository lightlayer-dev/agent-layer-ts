import { describe, it, expect } from "vitest";
import Koa from "koa";
import request from "supertest";
import { unifiedDiscovery } from "./unified-discovery.js";
import type { UnifiedDiscoveryConfig } from "@agent-layer/core";

const config: UnifiedDiscoveryConfig = {
  name: "Test API",
  description: "A test API",
  url: "https://test.example.com",
  version: "1.0.0",
  skills: [
    { id: "greet", name: "Greeting", description: "Says hello" },
  ],
  auth: { type: "api_key", in: "header", name: "X-API-Key" },
};

function createApp(cfg: UnifiedDiscoveryConfig = config) {
  const app = new Koa();
  const { router } = unifiedDiscovery(cfg);
  app.use(router.routes());
  app.use(router.allowedMethods());
  return app.callback();
}

describe("unifiedDiscovery Koa middleware", () => {
  it("serves /.well-known/ai", async () => {
    const res = await request(createApp()).get("/.well-known/ai").expect(200);
    expect(res.body.name).toBe("Test API");
  });

  it("serves /.well-known/agent.json", async () => {
    const res = await request(createApp()).get("/.well-known/agent.json").expect(200);
    expect(res.body.protocolVersion).toBe("1.0.0");
    expect(res.body.skills).toHaveLength(1);
  });

  it("serves /agents.txt", async () => {
    const res = await request(createApp())
      .get("/agents.txt")
      .expect(200);
    expect(res.text).toContain("User-agent: *");
  });

  it("serves /llms.txt", async () => {
    const res = await request(createApp())
      .get("/llms.txt")
      .expect(200);
    expect(res.text).toContain("# Test API");
    expect(res.text).toContain("## Greeting");
  });

  it("respects disabled formats", async () => {
    const app = createApp({ ...config, formats: { agentsTxt: false } });
    await request(app).get("/.well-known/ai").expect(200);
    await request(app).get("/agents.txt").expect(404);
  });
});
