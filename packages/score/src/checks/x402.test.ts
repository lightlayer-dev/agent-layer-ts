import { describe, it, expect, vi, afterEach } from "vitest";
import { checkX402 } from "./x402.js";
import type { ScanConfig } from "../types.js";

const config: ScanConfig = {
  url: "https://example.com",
  timeoutMs: 5000,
  userAgent: "test",
};

describe("checkX402", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("scores 0 when no x402 support detected", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes(".well-known/x402")) {
        return Promise.resolve({
          status: 404,
          headers: new Headers({}),
          text: () => Promise.resolve("Not Found"),
        });
      }
      return Promise.resolve({
        status: 200,
        headers: new Headers({}),
        text: () => Promise.resolve(""),
      });
    }) as any;

    const result = await checkX402(config);
    expect(result.id).toBe("x402");
    expect(result.score).toBe(0);
    expect(result.severity).toBe("fail");
  });

  it("scores well when .well-known/x402 exists", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes(".well-known/x402")) {
        return Promise.resolve({
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve('{"supported": true}'),
        });
      }
      return Promise.resolve({
        status: 200,
        headers: new Headers({}),
        text: () => Promise.resolve(""),
      });
    }) as any;

    const result = await checkX402(config);
    expect(result.score).toBeGreaterThanOrEqual(4);
  });

  it("scores high with full x402 support", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes(".well-known/x402")) {
        return Promise.resolve({
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve('{"supported": true}'),
        });
      }
      if (url.includes("__x402_probe__")) {
        return Promise.resolve({
          status: 402,
          headers: new Headers({ "content-type": "application/json" }),
          text: () =>
            Promise.resolve(
              JSON.stringify({
                paymentAddress: "0x123",
                network: "base",
                amount: "0.001",
                currency: "USDC",
              }),
            ),
        });
      }
      return Promise.resolve({
        status: 200,
        headers: new Headers({
          "x-payment-address": "0x123",
          "x-payment-network": "base",
        }),
        text: () => Promise.resolve(""),
      });
    }) as any;

    const result = await checkX402(config);
    expect(result.score).toBe(10);
    expect(result.severity).toBe("pass");
  });

  it("returns 0 when server unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("fail")) as any;

    const result = await checkX402(config);
    expect(result.score).toBe(0);
  });
});
