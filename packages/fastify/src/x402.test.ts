import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { x402Payment } from "./x402.js";
import type { X402Config } from "./x402.js";
import {
  HEADER_PAYMENT_SIGNATURE,
  HEADER_PAYMENT_REQUIRED,
  HEADER_PAYMENT_RESPONSE,
} from "@agent-layer/core/x402";
import type { FacilitatorClient, PaymentPayload } from "@agent-layer/core/x402";

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
      network: "eip155:8453",
      description: "Weather data",
    },
  },
};

function makePayload(overrides: Partial<PaymentPayload> = {}): PaymentPayload {
  return {
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
    payload: { signature: "0xdeadbeef" },
    ...overrides,
  };
}

function encodePayload(payload: PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

describe("x402Payment plugin (Fastify)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through requests for non-protected routes", async () => {
    const app = Fastify();
    await app.register(x402Payment(baseConfig));
    app.get("/api/free", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/api/free",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("returns 402 when no payment header is provided", async () => {
    const app = Fastify();
    await app.register(x402Payment(baseConfig));
    app.get("/api/weather", async () => ({ temp: 72 }));

    const res = await app.inject({
      method: "GET",
      url: "/api/weather",
    });

    expect(res.statusCode).toBe(402);
    expect(res.headers[HEADER_PAYMENT_REQUIRED]).toBeDefined();
    const body = res.json();
    expect(body.x402Version).toBe(1);
    expect(body.accepts).toHaveLength(1);
    expect(body.accepts[0].payTo).toBe("0xPayeeAddress");
  });

  it("verifies and settles valid payment, then continues", async () => {
    const app = Fastify();
    await app.register(x402Payment(baseConfig));
    app.get("/api/weather", async () => ({ temp: 72 }));

    const res = await app.inject({
      method: "GET",
      url: "/api/weather",
      headers: { [HEADER_PAYMENT_SIGNATURE]: encodePayload(makePayload()) },
    });

    expect(mockFacilitator.verify).toHaveBeenCalled();
    expect(mockFacilitator.settle).toHaveBeenCalled();
    expect(res.headers[HEADER_PAYMENT_RESPONSE]).toBeDefined();
    expect(res.statusCode).toBe(200);
  });

  it("returns 402 when verification fails", async () => {
    const failFacilitator: FacilitatorClient = {
      verify: vi.fn().mockResolvedValue({ isValid: false, invalidReason: "Signature expired" }),
      settle: vi.fn(),
    };
    const app = Fastify();
    await app.register(x402Payment({ ...baseConfig, facilitator: failFacilitator }));
    app.get("/api/weather", async () => ({ temp: 72 }));

    const payload = makePayload({ payload: { signature: "0xbad" } });
    const res = await app.inject({
      method: "GET",
      url: "/api/weather",
      headers: { [HEADER_PAYMENT_SIGNATURE]: encodePayload(payload) },
    });

    expect(res.statusCode).toBe(402);
    const body = res.json();
    expect(body.error).toBe("Signature expired");
    expect(failFacilitator.settle).not.toHaveBeenCalled();
  });

  it("returns 502 when facilitator is unreachable", async () => {
    const brokenFacilitator: FacilitatorClient = {
      verify: vi.fn().mockRejectedValue(new Error("Connection refused")),
      settle: vi.fn(),
    };
    const app = Fastify();
    await app.register(x402Payment({ ...baseConfig, facilitator: brokenFacilitator }));
    app.get("/api/weather", async () => ({ temp: 72 }));

    const payload = makePayload({ payload: { signature: "0x123" } });
    const res = await app.inject({
      method: "GET",
      url: "/api/weather",
      headers: { [HEADER_PAYMENT_SIGNATURE]: encodePayload(payload) },
    });

    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.error).toBe("payment_verification_failed");
  });
});
