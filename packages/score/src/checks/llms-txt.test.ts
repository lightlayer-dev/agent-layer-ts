import { describe, it, expect, vi, afterEach } from "vitest";
import { checkLlmsTxt } from "./llms-txt.js";
import type { ScanConfig } from "../types.js";

const config: ScanConfig = {
  url: "https://api.example.com",
  timeoutMs: 5000,
  userAgent: "TestAgent/1.0",
};

describe("checkLlmsTxt", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("scores high for well-structured llms.txt", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("llms.txt") && !url.includes("full")) {
        return Promise.resolve({
          status: 200,
          headers: new Headers(),
          text: () => Promise.resolve("# API Documentation\n\n> Summary here\n\nThis is a detailed description of the API with more than 200 characters of content to ensure we pass the length check. The API provides various endpoints for managing resources.\n\n## Endpoints\n\n..."),
        });
      }
      return Promise.resolve({ status: 404, headers: new Headers() });
    }) as any;

    const result = await checkLlmsTxt(config);
    expect(result.score).toBeGreaterThanOrEqual(7);
  });

  it("scores 0 when no llms.txt exists", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      headers: new Headers(),
    }) as any;

    const result = await checkLlmsTxt(config);
    expect(result.score).toBe(0);
    expect(result.severity).toBe("fail");
  });

  it("gives bonus for llms-full.txt variant", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("llms")) {
        return Promise.resolve({
          status: 200,
          headers: new Headers(),
          text: () => Promise.resolve("# Full API docs\n\nLots of content here for agents to consume about the API structure and endpoints and usage patterns."),
        });
      }
      return Promise.resolve({ status: 404, headers: new Headers() });
    }) as any;

    const result = await checkLlmsTxt(config);
    expect(result.score).toBeGreaterThanOrEqual(8);
  });
});
