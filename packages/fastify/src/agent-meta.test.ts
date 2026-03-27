import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { agentMeta } from "./agent-meta.js";

describe("agentMeta plugin (Fastify)", () => {
  it("injects data-agent-id into body tag", async () => {
    const app = Fastify();
    await app.register(agentMeta());
    app.get("/", async (_request, reply) => {
      reply.type("text/html").send("<html><body><p>Hello</p></body></html>");
    });

    const res = await app.inject({ method: "GET", url: "/" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('data-agent-id="root"');
  });

  it("injects meta tags into head", async () => {
    const app = Fastify();
    await app.register(
      agentMeta({
        metaTags: {
          "agent-api": "https://api.example.com",
          "agent-version": "1.0",
        },
      }),
    );
    app.get("/", async (_request, reply) => {
      reply.type("text/html").send("<html><head><title>Test</title></head><body></body></html>");
    });

    const res = await app.inject({ method: "GET", url: "/" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<meta name="agent-api" content="https://api.example.com">');
    expect(res.body).toContain('<meta name="agent-version" content="1.0">');
  });

  it("adds ARIA role=main to main tags", async () => {
    const app = Fastify();
    await app.register(agentMeta());
    app.get("/", async (_request, reply) => {
      reply.type("text/html").send("<html><body><main><p>Content</p></main></body></html>");
    });

    const res = await app.inject({ method: "GET", url: "/" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<main role="main"');
  });

  it("does not modify non-HTML responses", async () => {
    const app = Fastify();
    await app.register(agentMeta({ metaTags: { test: "value" } }));
    app.get("/api", async () => ({ ok: true }));

    const res = await app.inject({ method: "GET", url: "/api" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({ ok: true });
    expect(res.body).not.toContain("data-agent-id");
    expect(res.body).not.toContain("<meta");
  });
});
