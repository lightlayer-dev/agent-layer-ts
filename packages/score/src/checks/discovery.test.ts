import { describe, it, expect, vi, afterEach } from "vitest";
import { checkDiscovery } from "./discovery.js";
import type { ScanConfig } from "../types.js";

const config: ScanConfig = {
  url: "https://api.example.com",
  timeoutMs: 5000,
  userAgent: "TestAgent/1.0",
};

describe("checkDiscovery", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("scores 10 when multiple discovery endpoints exist", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("agent-card.json") || url.includes("agent.json")) {
        return Promise.resolve({ status: 200, headers: new Headers() });
      }
      return Promise.resolve({ status: 404, headers: new Headers() });
    }) as any;

    const result = await checkDiscovery(config);
    expect(result.score).toBe(10);
    expect(result.severity).toBe("pass");
  });

  it("scores 7 when one discovery endpoint exists", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("agent-card.json")) {
        return Promise.resolve({ status: 200, headers: new Headers() });
      }
      return Promise.resolve({ status: 404, headers: new Headers() });
    }) as any;

    const result = await checkDiscovery(config);
    expect(result.score).toBe(7);
    expect(result.severity).toBe("warn");
  });

  it("scores 0 when no discovery endpoints exist", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      headers: new Headers(),
    }) as any;

    const result = await checkDiscovery(config);
    expect(result.score).toBe(0);
    expect(result.severity).toBe("fail");
  });
});
