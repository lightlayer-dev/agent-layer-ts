import { describe, it, expect } from "vitest";
import { agentLayer } from "./index.js";

describe("agentLayer one-liner", () => {
  it("returns a Hono app", () => {
    const app = agentLayer({});
    expect(app).toBeDefined();
    expect(typeof app.fetch).toBe("function");
  });

  it("registers llms.txt routes when configured", async () => {
    const app = agentLayer({
      llmsTxt: { title: "Test API" },
      errors: false,
    });

    const res = await app.request("/llms.txt");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("# Test API");
  });

  it("registers discovery routes when configured", async () => {
    const app = agentLayer({
      discovery: { manifest: { name: "API" } },
      errors: false,
    });

    const res = await app.request("/.well-known/ai");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.name).toBe("API");
  });

  it("registers auth discovery route when configured", async () => {
    const app = agentLayer({
      agentAuth: {
        issuer: "https://auth.example.com",
        tokenUrl: "https://auth.example.com/token",
      },
      errors: false,
    });

    const res = await app.request("/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.issuer).toBe("https://auth.example.com");
  });

  it("skips features that are disabled", async () => {
    const app = agentLayer({
      errors: false,
      rateLimit: false,
      llmsTxt: false,
      discovery: false,
      agentAuth: false,
      agentMeta: false,
    });

    const res = await app.request("/llms.txt");
    expect(res.status).toBe(404);
  });

  it("composes rate limiting with routes", async () => {
    const app = agentLayer({
      rateLimit: { max: 100, windowMs: 60000 },
      llmsTxt: { title: "Test" },
      errors: false,
    });

    const res = await app.request("/llms.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-ratelimit-limit")).toBe("100");
  });
});
