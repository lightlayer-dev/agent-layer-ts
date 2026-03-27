import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkStructuredErrors } from "./structured-errors.js";
import type { ScanConfig } from "../types.js";

const config: ScanConfig = {
  url: "https://api.example.com",
  timeoutMs: 5000,
  userAgent: "TestAgent/1.0",
};

describe("checkStructuredErrors", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("scores 10 when all error responses return JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
    }) as any;

    const result = await checkStructuredErrors(config);
    expect(result.score).toBe(10);
    expect(result.severity).toBe("pass");
  });

  it("scores 0 when error responses return HTML", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      headers: new Headers({ "content-type": "text/html" }),
    }) as any;

    const result = await checkStructuredErrors(config);
    expect(result.score).toBe(0);
    expect(result.severity).toBe("fail");
    expect(result.suggestion).toBeDefined();
  });

  it("scores 5 for mixed JSON/HTML responses", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      const ct = callCount === 1 ? "application/json" : "text/html";
      return Promise.resolve({
        status: 404,
        headers: new Headers({ "content-type": ct }),
      });
    }) as any;

    const result = await checkStructuredErrors(config);
    expect(result.score).toBe(5);
    expect(result.severity).toBe("warn");
  });

  it("handles unreachable server", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as any;

    const result = await checkStructuredErrors(config);
    expect(result.score).toBe(0);
    expect(result.message).toContain("Could not reach");
  });

  it("recognizes application/problem+json", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      headers: new Headers({ "content-type": "application/problem+json" }),
    }) as any;

    const result = await checkStructuredErrors(config);
    expect(result.score).toBe(10);
  });
});
