import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { agentMeta } from "./agent-meta.js";

describe("agentMeta middleware", () => {
  it("injects data-agent-id into <body> tag", async () => {
    const app = new Hono();
    app.use("*", agentMeta());
    app.get("/", (c) => c.html("<html><body><p>Hello</p></body></html>"));

    const res = await app.request("/");
    const text = await res.text();

    expect(text).toContain('data-agent-id="root"');
  });

  it("injects meta tags into <head>", async () => {
    const app = new Hono();
    app.use("*", agentMeta({ metaTags: { "ai-purpose": "api-docs" } }));
    app.get("/", (c) =>
      c.html('<html><head><title>Test</title></head><body></body></html>'),
    );

    const res = await app.request("/");
    const text = await res.text();

    expect(text).toContain('name="ai-purpose"');
    expect(text).toContain('content="api-docs"');
  });

  it("adds ARIA role=main to <main> tags", async () => {
    const app = new Hono();
    app.use("*", agentMeta());
    app.get("/", (c) =>
      c.html("<html><body><main><p>Content</p></main></body></html>"),
    );

    const res = await app.request("/");
    const text = await res.text();

    expect(text).toContain('role="main"');
  });

  it("does not modify non-HTML responses", async () => {
    const app = new Hono();
    app.use("*", agentMeta());
    app.get("/", (c) => c.json({ key: "value" }));

    const res = await app.request("/");
    const body = await res.json();

    expect(body).toEqual({ key: "value" });
  });

  it("uses custom agent ID attribute name", async () => {
    const app = new Hono();
    app.use("*", agentMeta({ agentIdAttribute: "data-bot-id" }));
    app.get("/", (c) => c.html("<html><body><p>Hi</p></body></html>"));

    const res = await app.request("/");
    const text = await res.text();

    expect(text).toContain('data-bot-id="root"');
    expect(text).not.toContain("data-agent-id");
  });

  it("skips ARIA when ariaLandmarks is false", async () => {
    const app = new Hono();
    app.use("*", agentMeta({ ariaLandmarks: false }));
    app.get("/", (c) =>
      c.html("<html><body><main><p>Content</p></main></body></html>"),
    );

    const res = await app.request("/");
    const text = await res.text();

    expect(text).not.toContain('role="main"');
  });
});
