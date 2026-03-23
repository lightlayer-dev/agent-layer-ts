import { describe, it, expect, vi, afterEach } from "vitest";
import { checkAgUi } from "./ag-ui.js";
import type { ScanConfig } from "../types.js";

const cfg: ScanConfig = {
  url: "https://example.com",
  timeoutMs: 5000,
  userAgent: "test",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkAgUi", () => {
  it("returns fail when no AG-UI endpoint found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );
    const result = await checkAgUi(cfg);
    expect(result.id).toBe("ag-ui");
    expect(result.score).toBe(0);
    expect(result.severity).toBe("fail");
  });

  it("returns pass when AG-UI endpoint returns 200", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/ag-ui")) {
        return new Response("OK", { status: 200 });
      }
      return new Response("Not Found", { status: 404 });
    });
    const result = await checkAgUi(cfg);
    expect(result.score).toBe(5);
    expect(result.severity).toBe("pass");
  });

  it("returns pass when AG-UI endpoint returns 405 (POST-only)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/api/ag-ui")) {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return new Response("Not Found", { status: 404 });
    });
    const result = await checkAgUi(cfg);
    expect(result.score).toBe(5);
    expect(result.severity).toBe("pass");
  });
});
