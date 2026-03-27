import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { agentErrors } from "./agent-errors.js";
import { AgentError } from "@agent-layer/core";

describe("agentErrors plugin", () => {
  it("formats AgentError as JSON for agent clients", async () => {
    const app = Fastify();
    await app.register(agentErrors);
    app.get("/fail", () => {
      throw new AgentError({ code: "bad_input", message: "Bad", status: 400 });
    });

    const res = await app.inject({
      method: "GET",
      url: "/fail",
      headers: { accept: "application/json", "user-agent": "test-agent" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe("bad_input");
    expect(body.error.type).toBe("invalid_request_error");
  });

  it("formats generic Error with status property", async () => {
    const app = Fastify();
    await app.register(agentErrors);
    app.get("/fail", () => {
      throw Object.assign(new Error("Not found"), { statusCode: 404 });
    });

    const res = await app.inject({
      method: "GET",
      url: "/fail",
      headers: { accept: "application/json", "user-agent": "test-agent" },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe("internal_error");
  });

  it("defaults to 500 for plain errors", async () => {
    const app = Fastify();
    await app.register(agentErrors);
    app.get("/fail", () => {
      throw new Error("oops");
    });

    const res = await app.inject({
      method: "GET",
      url: "/fail",
      headers: { accept: "application/json", "user-agent": "test-agent" },
    });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error.is_retriable).toBe(true);
  });

  it("returns HTML for browser Accept header", async () => {
    const app = Fastify();
    await app.register(agentErrors);
    app.get("/fail", () => {
      throw new Error("fail");
    });

    const res = await app.inject({
      method: "GET",
      url: "/fail",
      headers: { accept: "text/html", "user-agent": "Mozilla/5.0" },
    });

    expect(res.statusCode).toBe(500);
    expect(res.body).toContain("<!DOCTYPE html>");
    expect(res.body).toContain("500");
  });

  it("sets Retry-After header for rate limit errors", async () => {
    const app = Fastify();
    await app.register(agentErrors);
    app.get("/fail", () => {
      throw new AgentError({
        code: "rate_limit",
        message: "Slow down",
        status: 429,
        retry_after: 30,
      });
    });

    const res = await app.inject({
      method: "GET",
      url: "/fail",
      headers: { accept: "application/json", "user-agent": "test-agent" },
    });

    expect(res.headers["retry-after"]).toBe("30");
  });

  it("handles 404 for unknown routes", async () => {
    const app = Fastify();
    await app.register(agentErrors);
    app.get("/exists", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/nope",
      headers: { accept: "application/json", "user-agent": "test-agent" },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toContain("GET");
    expect(body.error.message).toContain("/nope");
  });
});
