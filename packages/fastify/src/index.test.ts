import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { agentLayer } from "./index.js";

describe("agentLayer one-liner (Fastify)", () => {
  it("registers llms.txt routes", async () => {
    const app = Fastify();
    await app.register(
      agentLayer({
        llmsTxt: { title: "Test API", description: "A test" },
        errors: false,
      }),
    );

    const res = await app.inject({ method: "GET", url: "/llms.txt" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("# Test API");
  });

  it("registers discovery routes", async () => {
    const app = Fastify();
    await app.register(
      agentLayer({
        discovery: { manifest: { name: "API", description: "Test" } },
        errors: false,
      }),
    );

    const res = await app.inject({ method: "GET", url: "/.well-known/ai" });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("API");
  });

  it("registers A2A agent card route", async () => {
    const app = Fastify();
    await app.register(
      agentLayer({
        a2a: {
          card: {
            protocolVersion: "1.0.0",
            name: "Agent",
            url: "https://example.com",
            skills: [],
          },
        },
        errors: false,
      }),
    );

    const res = await app.inject({
      method: "GET",
      url: "/.well-known/agent.json",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Agent");
  });

  it("registers agents.txt route", async () => {
    const app = Fastify();
    await app.register(
      agentLayer({
        agentsTxt: {
          rules: [{ agent: "*", allow: ["/api/*"] }],
          siteName: "Test",
        },
        errors: false,
      }),
    );

    const res = await app.inject({ method: "GET", url: "/agents.txt" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("User-agent: *");
  });

  it("can disable features with false", async () => {
    const app = Fastify();
    await app.register(
      agentLayer({
        llmsTxt: false,
        discovery: false,
        a2a: false,
        agentsTxt: false,
        errors: false,
      }),
    );

    const res = await app.inject({ method: "GET", url: "/llms.txt" });
    expect(res.statusCode).toBe(404);
  });
});
