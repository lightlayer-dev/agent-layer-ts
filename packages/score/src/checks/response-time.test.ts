import { describe, it, expect, vi, afterEach } from "vitest";
import { checkResponseTime } from "./response-time.js";
import type { ScanConfig } from "../types.js";

const config: ScanConfig = {
  url: "https://api.example.com",
  timeoutMs: 5000,
  userAgent: "TestAgent/1.0",
};

describe("checkResponseTime", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("scores 10 for fast responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
    }) as any;

    const result = await checkResponseTime(config);
    // Local mock fetch is near-instant
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.severity).toBe("pass");
  });

  it("handles unreachable server", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("timeout")) as any;

    const result = await checkResponseTime(config);
    expect(result.score).toBe(0);
    expect(result.message).toContain("Could not reach");
  });
});
