import { describe, it, expect, vi, afterEach } from "vitest";
import { scan } from "./scanner.js";

describe("scan", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("returns a score report with all checks", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "application/json; charset=utf-8" }),
      text: () => Promise.resolve("{}"),
    }) as any;

    const report = await scan({ url: "https://example.com", timeoutMs: 5000 });
    expect(report.url).toBe("https://example.com");
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.checks).toHaveLength(11);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(report.timestamp).toBeDefined();
  });

  it("adds https:// if missing", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      text: () => Promise.resolve(""),
    }) as any;

    const report = await scan({ url: "example.com", timeoutMs: 5000 });
    expect(report.url).toBe("https://example.com");
  });

  it("normalizes score to 0-100 range", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("fail")) as any;

    const report = await scan({ url: "https://unreachable.test", timeoutMs: 1000 });
    expect(report.score).toBe(0);
    expect(report.checks.every((c) => c.score === 0)).toBe(true);
  });
});
