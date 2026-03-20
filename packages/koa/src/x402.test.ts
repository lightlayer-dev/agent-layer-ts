import { describe, it, expect, vi, beforeEach } from "vitest";
import { x402Payment } from "./x402.js";
import type { X402Config } from "./x402.js";
import {
  HEADER_PAYMENT_SIGNATURE,
  HEADER_PAYMENT_REQUIRED,
  HEADER_PAYMENT_RESPONSE,
} from "@agent-layer/core/x402";
import type { FacilitatorClient, PaymentPayload } from "@agent-layer/core/x402";

function mockCtx(overrides: Record<string, unknown> = {}): any {
  const headers: Record<string, string> = {};
  const responseHeaders: Record<string, string> = {};
  return {
    method: "GET",
    path: "/api/weather",
    originalUrl: "/api/weather",
    protocol: "https",
    host: "api.example.com",
    status: 200,
    body: null as unknown,
    state: {},
    get(name: string) {
      return headers[name.toLowerCase()] ?? "";
    },
    set(name: string, value: string) {
      responseHeaders[name] = value;
    },
    _setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    _responseHeaders: responseHeaders,
    ...overrides,
  };
}

const mockFacilitator: FacilitatorClient = {
  verify: vi.fn().mockResolvedValue({ isValid: true }),
  settle: vi.fn().mockResolvedValue({ success: true, txHash: "0xabc123" }),
};

const baseConfig: X402Config = {
  facilitatorUrl: "https://facilitator.example.com",
  facilitator: mockFacilitator,
  routes: {
    "GET /api/weather": {
      payTo: "0xPayeeAddress",
      price: "$0.001",
      network: "eip155:8453" as const,
      description: "Weather data",
    },
  },
};

function makePaymentHeader(): string {
  const payload: PaymentPayload = {
    x402Version: 1,
    accepted: {
      scheme: "exact",
      network: "eip155:8453",
      asset: "USDC",
      amount: "0.001",
      payTo: "0xPayeeAddress",
      maxTimeoutSeconds: 60,
      extra: {},
    },
    payload: { signature: "0xSig" },
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

describe("x402Payment (Koa)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockFacilitator.verify as any).mockResolvedValue({ isValid: true });
    (mockFacilitator.settle as any).mockResolvedValue({ success: true, txHash: "0xabc123" });
  });

  it("passes through for non-payment routes", async () => {
    const mw = x402Payment(baseConfig);
    const ctx = mockCtx({ path: "/other", originalUrl: "/other" });
    const next = vi.fn();
    await mw(ctx, next);
    expect(next).toHaveBeenCalled();
    expect(ctx.status).toBe(200);
  });

  it("returns 402 when no payment header present", async () => {
    const mw = x402Payment(baseConfig);
    const ctx = mockCtx();
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.status).toBe(402);
    expect(ctx.body).toHaveProperty("x402Version", 1);
    expect(ctx.body.accepts).toHaveLength(1);
    expect(ctx._responseHeaders[HEADER_PAYMENT_REQUIRED]).toBeDefined();
    expect(next).not.toHaveBeenCalled();
  });

  it("verifies and settles valid payment", async () => {
    const mw = x402Payment(baseConfig);
    const ctx = mockCtx();
    ctx._setHeader(HEADER_PAYMENT_SIGNATURE, makePaymentHeader());
    const next = vi.fn();
    await mw(ctx, next);
    expect(mockFacilitator.verify).toHaveBeenCalled();
    expect(mockFacilitator.settle).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(ctx._responseHeaders[HEADER_PAYMENT_RESPONSE]).toBeDefined();
    expect(ctx.state.x402).toBeDefined();
    expect(ctx.state.x402.settlement.txHash).toBe("0xabc123");
  });

  it("returns 402 for invalid payment signature format", async () => {
    const mw = x402Payment(baseConfig);
    const ctx = mockCtx();
    ctx._setHeader(HEADER_PAYMENT_SIGNATURE, "not-valid-base64-json!!!");
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.status).toBe(402);
    expect(ctx.body.error).toContain("Invalid payment signature");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 402 when verification fails", async () => {
    (mockFacilitator.verify as any).mockResolvedValue({
      isValid: false,
      invalidReason: "Insufficient funds",
    });
    const mw = x402Payment(baseConfig);
    const ctx = mockCtx();
    ctx._setHeader(HEADER_PAYMENT_SIGNATURE, makePaymentHeader());
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.status).toBe(402);
    expect(ctx.body.error).toContain("Insufficient funds");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 502 when facilitator verify throws", async () => {
    (mockFacilitator.verify as any).mockRejectedValue(new Error("Network error"));
    const mw = x402Payment(baseConfig);
    const ctx = mockCtx();
    ctx._setHeader(HEADER_PAYMENT_SIGNATURE, makePaymentHeader());
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.status).toBe(502);
    expect(ctx.body.error).toBe("payment_verification_failed");
  });

  it("returns 402 when settlement fails", async () => {
    (mockFacilitator.settle as any).mockResolvedValue({
      success: false,
      errorReason: "Timeout",
    });
    const mw = x402Payment(baseConfig);
    const ctx = mockCtx();
    ctx._setHeader(HEADER_PAYMENT_SIGNATURE, makePaymentHeader());
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.status).toBe(402);
    expect(ctx.body.error).toContain("Timeout");
  });

  it("returns 502 when facilitator settle throws", async () => {
    (mockFacilitator.settle as any).mockRejectedValue(new Error("Network error"));
    const mw = x402Payment(baseConfig);
    const ctx = mockCtx();
    ctx._setHeader(HEADER_PAYMENT_SIGNATURE, makePaymentHeader());
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.status).toBe(502);
    expect(ctx.body.error).toBe("payment_settlement_failed");
  });

  it("resolves dollar-string prices to USDC", async () => {
    const mw = x402Payment(baseConfig);
    const ctx = mockCtx();
    const next = vi.fn();
    await mw(ctx, next);
    expect(ctx.body.accepts[0].asset).toBe("USDC");
    expect(ctx.body.accepts[0].amount).toBe("0.001");
  });
});
