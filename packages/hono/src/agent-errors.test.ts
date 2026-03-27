import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { agentErrors, notFoundHandler } from "./agent-errors.js";
import { AgentError } from "@agent-layer/core";

describe("agentErrors handler", () => {
  it("formats AgentError as JSON for agent clients", async () => {
    const app = new Hono();
    app.onError(agentErrors());
    app.get("/fail", () => {
      throw new AgentError({ code: "bad_input", message: "Bad", status: 400 });
    });

    const res = await app.request("/fail", {
      headers: { accept: "application/json", "user-agent": "test-agent" },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("bad_input");
    expect(body.error.type).toBe("invalid_request_error");
  });

  it("formats generic Error with status property", async () => {
    const app = new Hono();
    app.onError(agentErrors());
    app.get("/fail", () => {
      throw Object.assign(new Error("Not found"), { status: 404 });
    });

    const res = await app.request("/fail", {
      headers: { accept: "application/json", "user-agent": "test-agent" },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("internal_error");
  });

  it("defaults to 500 for plain errors", async () => {
    const app = new Hono();
    app.onError(agentErrors());
    app.get("/fail", () => {
      throw new Error("oops");
    });

    const res = await app.request("/fail", {
      headers: { accept: "application/json", "user-agent": "test-agent" },
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error.is_retriable).toBe(true);
  });

  it("returns HTML for browser Accept header", async () => {
    const app = new Hono();
    app.onError(agentErrors());
    app.get("/fail", () => {
      throw new Error("fail");
    });

    const res = await app.request("/fail", {
      headers: { accept: "text/html", "user-agent": "Mozilla/5.0" },
    });

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("<!DOCTYPE html>");
    expect(text).toContain("500");
  });

  it("sets Retry-After header for rate limit errors", async () => {
    const app = new Hono();
    app.onError(agentErrors());
    app.get("/fail", () => {
      throw new AgentError({
        code: "rate_limit",
        message: "Slow down",
        status: 429,
        retry_after: 30,
      });
    });

    const res = await app.request("/fail", {
      headers: { accept: "application/json", "user-agent": "test-agent" },
    });

    expect(res.headers.get("retry-after")).toBe("30");
  });

  it("returns JSON for curl-like user agents", async () => {
    const app = new Hono();
    app.onError(agentErrors());
    app.get("/fail", () => {
      throw new Error("fail");
    });

    const res = await app.request("/fail", {
      headers: { "user-agent": "curl/7.88.1" },
    });

    const body = (await res.json()) as any;
    expect(body.error.code).toBe("internal_error");
  });
});

describe("notFoundHandler", () => {
  it("returns 404 JSON for agents on unmatched routes", async () => {
    const app = new Hono();
    app.notFound(notFoundHandler());
    app.get("/exists", (c) => c.json({ ok: true }));

    const res = await app.request("/nope", {
      headers: { accept: "application/json", "user-agent": "test-agent" },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toContain("GET");
    expect(body.error.message).toContain("/nope");
  });
});
