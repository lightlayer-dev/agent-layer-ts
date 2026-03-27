import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRateLimits } from "./rate-limits.js";
import type { ScanConfig } from "../types.js";

const config: ScanConfig = {
  url: "https://api.example.com",
  timeoutMs: 5000,
  userAgent: "TestAgent/1.0",
};

describe("checkRateLimits", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("scores 10 with full rate limit headers", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({
        "x-ratelimit-limit": "100",
        "x-ratelimit-remaining": "95",
        "x-ratelimit-reset": "1234567890",
      }),
    }) as any;

    const result = await checkRateLimits(config);
    expect(result.score).toBe(10);
    expect(result.severity).toBe("pass");
  });

  it("scores 0 with no rate limit headers", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
    }) as any;

    const result = await checkRateLimits(config);
    expect(result.score).toBe(0);
    expect(result.severity).toBe("fail");
  });

  it("scores partial with only some headers", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({
        "x-ratelimit-limit": "100",
      }),
    }) as any;

    const result = await checkRateLimits(config);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(10);
  });
});
