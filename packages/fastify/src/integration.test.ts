import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { agentLayer } from "./index.js";
import { AgentError } from "@agent-layer/core";

describe("agentLayer integration (Fastify)", () => {
  it("LLMs.txt route responds", async () => {
    const app = Fastify();
    await app.register(
      agentLayer({
        llmsTxt: { title: "Integration API", description: "Integration test" },
        errors: false,
      }),
    );

    const res = await app.inject({ method: "GET", url: "/llms.txt" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("# Integration API");
    expect(res.body).toContain("> Integration test");
  });

  it("Discovery routes respond", async () => {
    const app = Fastify();
    await app.register(
      agentLayer({
        discovery: { manifest: { name: "Test API", description: "Integration" } },
        errors: false,
      }),
    );

    const res = await app.inject({ method: "GET", url: "/.well-known/ai" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("Test API");
    expect(body.description).toBe("Integration");
  });

  it("Error handling works", async () => {
    const app = Fastify();
    await app.register(
      agentLayer({
        errors: true,
      }),
    );
    app.get("/fail", () => {
      throw new AgentError({ code: "bad_input", message: "Test error", status: 400 });
    });

    const res = await app.inject({
      method: "GET",
      url: "/fail",
      headers: { accept: "application/json", "user-agent": "test-agent" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe("bad_input");
  });

  it("Rate limiting works", async () => {
    const app = Fastify();
    await app.register(
      agentLayer({
        rateLimit: { max: 2, windowMs: 60_000 },
        errors: false,
      }),
    );
    app.get("/limited", async () => ({ ok: true }));

    // First two requests should succeed
    const res1 = await app.inject({ method: "GET", url: "/limited" });
    expect(res1.statusCode).toBe(200);
    expect(res1.headers["x-ratelimit-limit"]).toBeDefined();

    const res2 = await app.inject({ method: "GET", url: "/limited" });
    expect(res2.statusCode).toBe(200);

    // Third request should be rate limited
    const res3 = await app.inject({ method: "GET", url: "/limited" });
    expect(res3.statusCode).toBe(429);
    expect(res3.headers["retry-after"]).toBeDefined();
  });
});
