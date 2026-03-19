import { describe, it, expect, vi } from "vitest";
import { agentErrors, notFoundHandler } from "./agent-errors.js";
import { AgentError } from "@agent-layer/core";

function mockCtx(overrides: Record<string, unknown> = {}): any {
  const _headers: Record<string, string> = {};
  return {
    headers: { accept: "application/json", "user-agent": "test-agent" },
    method: "GET",
    path: "/test",
    status: 404,
    body: null as unknown,
    type: "",
    _headers,
    set(key: string, val: string) {
      _headers[key.toLowerCase()] = val;
    },
    ...overrides,
  };
}

describe("agentErrors middleware", () => {
  it("formats AgentError as JSON for agent clients", async () => {
    const middleware = agentErrors();
    const ctx = mockCtx();
    const err = new AgentError({ code: "bad_input", message: "Bad", status: 400 });

    await middleware(ctx, async () => { throw err; });

    expect(ctx.status).toBe(400);
    expect(ctx.body.error.code).toBe("bad_input");
    expect(ctx.body.error.type).toBe("invalid_request_error");
  });

  it("formats generic Error with status property", async () => {
    const middleware = agentErrors();
    const ctx = mockCtx();
    const err = Object.assign(new Error("Not found"), { status: 404 });

    await middleware(ctx, async () => { throw err; });

    expect(ctx.status).toBe(404);
    expect(ctx.body.error.code).toBe("internal_error");
  });

  it("defaults to 500 for plain errors", async () => {
    const middleware = agentErrors();
    const ctx = mockCtx();

    await middleware(ctx, async () => { throw new Error("oops"); });

    expect(ctx.status).toBe(500);
    expect(ctx.body.error.is_retriable).toBe(true);
  });

  it("returns HTML for browser Accept header", async () => {
    const middleware = agentErrors();
    const ctx = mockCtx({
      headers: { accept: "text/html", "user-agent": "Mozilla/5.0" },
    });

    await middleware(ctx, async () => { throw new Error("fail"); });

    expect(ctx.type).toBe("html");
    expect(typeof ctx.body).toBe("string");
    expect(ctx.body).toContain("<!DOCTYPE html>");
    expect(ctx.body).toContain("500");
  });

  it("sets Retry-After header for rate limit errors", async () => {
    const middleware = agentErrors();
    const ctx = mockCtx();
    const err = new AgentError({
      code: "rate_limit",
      message: "Slow down",
      status: 429,
      retry_after: 30,
    });

    await middleware(ctx, async () => { throw err; });

    expect(ctx._headers["retry-after"]).toBe("30");
  });

  it("returns JSON for curl-like user agents", async () => {
    const middleware = agentErrors();
    const ctx = mockCtx({
      headers: { accept: "*/*", "user-agent": "curl/7.68.0" },
    });

    await middleware(ctx, async () => { throw new Error("fail"); });

    expect(ctx.body).toHaveProperty("error");
    expect(ctx.body.error.code).toBe("internal_error");
  });
});

describe("notFoundHandler", () => {
  it("returns 404 JSON for agents", async () => {
    const middleware = notFoundHandler();
    const ctx = mockCtx({ method: "GET", path: "/nope" });

    await middleware(ctx, async () => {});

    expect(ctx.status).toBe(404);
    expect(ctx.body.error.code).toBe("not_found");
    expect(ctx.body.error.message).toContain("GET /nope");
  });

  it("returns 404 HTML for browsers", async () => {
    const middleware = notFoundHandler();
    const ctx = mockCtx({
      method: "POST",
      path: "/missing",
      headers: { accept: "text/html", "user-agent": "Mozilla/5.0" },
    });

    await middleware(ctx, async () => {});

    expect(ctx.status).toBe(404);
    expect(typeof ctx.body).toBe("string");
    expect(ctx.body).toContain("not_found");
  });

  it("does not override existing response body", async () => {
    const middleware = notFoundHandler();
    const ctx = mockCtx();
    ctx.status = 200;

    await middleware(ctx, async () => {
      ctx.body = { ok: true };
      ctx.status = 200;
    });

    expect(ctx.body).toEqual({ ok: true });
  });
});
