import { describe, it, expect, vi } from "vitest";
import { agentMeta } from "./agent-meta.js";

function mockReq(): any {
  return {};
}

function mockRes(): any {
  const res: any = {
    headers: {} as Record<string, string>,
    body: null as unknown,
    send(data: unknown) {
      res.body = data;
      return res;
    },
    setHeader(key: string, val: string) {
      res.headers[key.toLowerCase()] = val;
    },
    getHeader(key: string) {
      return res.headers[key.toLowerCase()];
    },
  };
  return res;
}

describe("agentMeta middleware", () => {
  it("injects data-agent-id into <body> tag", () => {
    const middleware = agentMeta();
    const res = mockRes();
    res.headers["content-type"] = "text/html";
    const next = vi.fn();

    middleware(mockReq(), res, next);
    expect(next).toHaveBeenCalled();

    res.send("<html><body><p>Hello</p></body></html>");
    expect(res.body).toContain('data-agent-id="root"');
  });

  it("injects meta tags into <head>", () => {
    const middleware = agentMeta({
      metaTags: { "ai-purpose": "api-docs" },
    });
    const res = mockRes();
    res.headers["content-type"] = "text/html";
    const next = vi.fn();

    middleware(mockReq(), res, next);
    next.mock.calls[0]; // trigger next
    res.send('<html><head><title>Test</title></head><body></body></html>');

    expect(res.body).toContain('name="ai-purpose"');
    expect(res.body).toContain('content="api-docs"');
  });

  it("adds ARIA role=main to <main> tags", () => {
    const middleware = agentMeta();
    const res = mockRes();
    res.headers["content-type"] = "text/html";
    const next = vi.fn();

    middleware(mockReq(), res, next);
    res.send("<html><body><main><p>Content</p></main></body></html>");

    expect(res.body).toContain('role="main"');
  });

  it("does not modify non-HTML responses", () => {
    const middleware = agentMeta();
    const res = mockRes();
    res.headers["content-type"] = "application/json";
    const next = vi.fn();

    middleware(mockReq(), res, next);
    const jsonData = '{"key": "value"}';
    res.send(jsonData);

    expect(res.body).toBe(jsonData);
  });

  it("uses custom agent ID attribute name", () => {
    const middleware = agentMeta({ agentIdAttribute: "data-bot-id" });
    const res = mockRes();
    res.headers["content-type"] = "text/html";
    const next = vi.fn();

    middleware(mockReq(), res, next);
    res.send("<html><body><p>Hi</p></body></html>");

    expect(res.body).toContain('data-bot-id="root"');
    expect(res.body).not.toContain("data-agent-id");
  });

  it("skips ARIA when ariaLandmarks is false", () => {
    const middleware = agentMeta({ ariaLandmarks: false });
    const res = mockRes();
    res.headers["content-type"] = "text/html";
    const next = vi.fn();

    middleware(mockReq(), res, next);
    res.send("<html><body><main><p>Content</p></main></body></html>");

    expect(res.body).not.toContain('role="main"');
  });
});
