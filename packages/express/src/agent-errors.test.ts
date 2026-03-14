import { describe, it, expect, vi } from "vitest";
import { agentErrors, notFoundHandler } from "./agent-errors.js";
import { AgentError } from "@agent-layer/core";

function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    headers: { accept: "application/json", "user-agent": "test-agent" },
    method: "GET",
    path: "/test",
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
    type(t: string) {
      res.headers["content-type"] = t;
      return res;
    },
    send(data: unknown) {
      res.body = data;
      return res;
    },
    setHeader(key: string, val: string) {
      res.headers[key.toLowerCase()] = val;
      return res;
    },
    getHeader(key: string) {
      return res.headers[key.toLowerCase()];
    },
  };
  return res;
}

describe("agentErrors middleware", () => {
  const handler = agentErrors();

  it("formats AgentError as JSON for agent clients", () => {
    const req = mockReq();
    const res = mockRes();
    const err = new AgentError({ code: "bad_input", message: "Bad", status: 400 });

    handler(err, req, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("bad_input");
    expect(res.body.error.type).toBe("invalid_request_error");
  });

  it("formats generic Error with status property", () => {
    const req = mockReq();
    const res = mockRes();
    const err = Object.assign(new Error("Not found"), { status: 404 });

    handler(err, req, res, vi.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("internal_error");
  });

  it("defaults to 500 for plain errors", () => {
    const req = mockReq();
    const res = mockRes();

    handler(new Error("oops"), req, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body.error.is_retriable).toBe(true);
  });

  it("returns HTML for browser Accept header", () => {
    const req = mockReq({ headers: { accept: "text/html", "user-agent": "Mozilla/5.0" } });
    const res = mockRes();

    handler(new Error("fail"), req, res, vi.fn());

    expect(res.headers["content-type"]).toBe("html");
    expect(typeof res.body).toBe("string");
    expect(res.body).toContain("<!DOCTYPE html>");
    expect(res.body).toContain("500");
  });

  it("sets Retry-After header for rate limit errors", () => {
    const req = mockReq();
    const res = mockRes();
    const err = new AgentError({
      code: "rate_limit",
      message: "Slow down",
      status: 429,
      retry_after: 30,
    });

    handler(err, req, res, vi.fn());

    expect(res.headers["retry-after"]).toBe("30");
  });

  it("returns JSON for curl-like user agents", () => {
    const req = mockReq({
      headers: { accept: "*/*", "user-agent": "curl/7.68.0" },
    });
    const res = mockRes();

    handler(new Error("fail"), req, res, vi.fn());

    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("internal_error");
  });
});

describe("notFoundHandler", () => {
  const handler = notFoundHandler();

  it("returns 404 JSON for agents", () => {
    const req = mockReq({ method: "GET", path: "/nope" });
    const res = mockRes();

    handler(req, res, vi.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("not_found");
    expect(res.body.error.message).toContain("GET /nope");
  });

  it("returns 404 HTML for browsers", () => {
    const req = mockReq({
      method: "POST",
      path: "/missing",
      headers: { accept: "text/html", "user-agent": "Mozilla/5.0" },
    });
    const res = mockRes();

    handler(req, res, vi.fn());

    expect(res.statusCode).toBe(404);
    expect(typeof res.body).toBe("string");
    expect(res.body).toContain("not_found");
  });
});
