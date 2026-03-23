import { describe, it, expect, vi, afterEach } from "vitest";
import { checkAgentsTxt } from "./agents-txt.js";
import type { ScanConfig } from "../types.js";

const cfg: ScanConfig = {
  url: "https://example.com",
  timeoutMs: 5000,
  userAgent: "test",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkAgentsTxt", () => {
  it("returns fail when no agents.txt found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );
    const result = await checkAgentsTxt(cfg);
    expect(result.id).toBe("agents-txt");
    expect(result.score).toBe(0);
    expect(result.severity).toBe("fail");
  });

  it("returns warn for empty agents.txt", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("# Just a comment\n", { status: 200 }),
    );
    const result = await checkAgentsTxt(cfg);
    expect(result.score).toBe(3);
    expect(result.severity).toBe("warn");
  });

  it("returns warn for agents.txt with only user-agent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("User-Agent: *\nAllow: /api\n", { status: 200 }),
    );
    const result = await checkAgentsTxt(cfg);
    expect(result.score).toBe(6);
    expect(result.severity).toBe("warn");
  });

  it("returns pass for comprehensive agents.txt", async () => {
    const body = [
      "User-Agent: *",
      "Allow: /api",
      "Disallow: /admin",
      "Auth: bearer",
      "Rate-Limit: 100/hour",
    ].join("\n");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, { status: 200 }),
    );
    const result = await checkAgentsTxt(cfg);
    expect(result.score).toBe(10);
    expect(result.severity).toBe("pass");
  });
});
