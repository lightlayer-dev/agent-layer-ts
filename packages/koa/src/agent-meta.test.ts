import { describe, it, expect, vi } from "vitest";
import { agentMeta } from "./agent-meta.js";

function mockCtx(overrides: Record<string, unknown> = {}): any {
  return {
    type: "",
    body: null as unknown,
    ...overrides,
  };
}

describe("agentMeta middleware", () => {
  it("injects data-agent-id into <body> tag", async () => {
    const middleware = agentMeta();
    const ctx = mockCtx();

    await middleware(ctx, async () => {
      ctx.type = "text/html";
      ctx.body = "<html><body><p>Hello</p></body></html>";
    });

    expect(ctx.body).toContain('data-agent-id="root"');
  });

  it("injects meta tags into <head>", async () => {
    const middleware = agentMeta({
      metaTags: { "ai-purpose": "api-docs" },
    });
    const ctx = mockCtx();

    await middleware(ctx, async () => {
      ctx.type = "text/html";
      ctx.body = '<html><head><title>Test</title></head><body></body></html>';
    });

    expect(ctx.body).toContain('name="ai-purpose"');
    expect(ctx.body).toContain('content="api-docs"');
  });

  it("adds ARIA role=main to <main> tags", async () => {
    const middleware = agentMeta();
    const ctx = mockCtx();

    await middleware(ctx, async () => {
      ctx.type = "text/html";
      ctx.body = "<html><body><main><p>Content</p></main></body></html>";
    });

    expect(ctx.body).toContain('role="main"');
  });

  it("does not modify non-HTML responses", async () => {
    const middleware = agentMeta();
    const ctx = mockCtx();
    const jsonData = '{"key": "value"}';

    await middleware(ctx, async () => {
      ctx.type = "application/json";
      ctx.body = jsonData;
    });

    expect(ctx.body).toBe(jsonData);
  });

  it("uses custom agent ID attribute name", async () => {
    const middleware = agentMeta({ agentIdAttribute: "data-bot-id" });
    const ctx = mockCtx();

    await middleware(ctx, async () => {
      ctx.type = "text/html";
      ctx.body = "<html><body><p>Hi</p></body></html>";
    });

    expect(ctx.body).toContain('data-bot-id="root"');
    expect(ctx.body).not.toContain("data-agent-id");
  });

  it("skips ARIA when ariaLandmarks is false", async () => {
    const middleware = agentMeta({ ariaLandmarks: false });
    const ctx = mockCtx();

    await middleware(ctx, async () => {
      ctx.type = "text/html";
      ctx.body = "<html><body><main><p>Content</p></main></body></html>";
    });

    expect(ctx.body).not.toContain('role="main"');
  });
});
