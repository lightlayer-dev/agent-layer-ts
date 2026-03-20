import { describe, it, expect, vi, beforeEach } from "vitest";
import { x402Payment } from "./x402.js";
import type { X402Config } from "./x402.js";
import {
  HEADER_PAYMENT_SIGNATURE,
  HEADER_PAYMENT_REQUIRED,
  HEADER_PAYMENT_RESPONSE,
} from "@agent-layer/core/x402";
import type { FacilitatorClient, PaymentPayload } from "@agent-layer/core/x402";

function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    method: "GET",
    path: "/api/weather",
    originalUrl: "/api/weather",
    protocol: "https",
    headers: {},
    get(name: string) {
      if (name === "host") return "api.example.com";
      return undefined;
    },
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    set(name: string, value: string) {
      res.headers[name] = value;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res;
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
      network: "eip155:8453",
      description: "Weather data",
    },
  },
};

describe("x402Payment middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through requests for non-protected routes", async () => {
    const mw = x402Payment(baseConfig);
    const req = mockReq({ path: "/api/free", originalUrl: "/api/free" });
    const res = mockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("returns 402 when no payment header is provided", async () => {
    const mw = x402Payment(baseConfig);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(res.statusCode).toBe(402);
    expect(res.headers[HEADER_PAYMENT_REQUIRED]).toBeDefined();
    expect(res.body.x402Version).toBe(1);
    expect(res.body.accepts).toHaveLength(1);
    expect(res.body.accepts[0].payTo).toBe("0xPayeeAddress");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 402 for invalid payment signature format", async () => {
    const mw = x402Payment(baseConfig);
    const req = mockReq({
      headers: { [HEADER_PAYMENT_SIGNATURE]: "not-valid-base64!!!" },
    });
    const res = mockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(res.statusCode).toBe(402);
    expect(res.body.error).toBe("Invalid payment signature format");
    expect(next).not.toHaveBeenCalled();
  });

  it("verifies and settles valid payment, then calls next()", async () => {
    const mw = x402Payment(baseConfig);
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
      payload: { signature: "0xdeadbeef" },
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    const req = mockReq({
      headers: { [HEADER_PAYMENT_SIGNATURE]: encoded },
    });
    const res = mockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(mockFacilitator.verify).toHaveBeenCalled();
    expect(mockFacilitator.settle).toHaveBeenCalled();
    expect(res.headers[HEADER_PAYMENT_RESPONSE]).toBeDefined();
    expect(req.x402).toBeDefined();
    expect(req.x402.settlement.txHash).toBe("0xabc123");
    expect(next).toHaveBeenCalled();
  });

  it("returns 402 when verification fails", async () => {
    const failFacilitator: FacilitatorClient = {
      verify: vi.fn().mockResolvedValue({ isValid: false, invalidReason: "Signature expired" }),
      settle: vi.fn(),
    };
    const mw = x402Payment({ ...baseConfig, facilitator: failFacilitator });
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
      payload: { signature: "0xbad" },
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    const req = mockReq({
      headers: { [HEADER_PAYMENT_SIGNATURE]: encoded },
    });
    const res = mockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(res.statusCode).toBe(402);
    expect(res.body.error).toBe("Signature expired");
    expect(failFacilitator.settle).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 502 when facilitator is unreachable", async () => {
    const brokenFacilitator: FacilitatorClient = {
      verify: vi.fn().mockRejectedValue(new Error("Connection refused")),
      settle: vi.fn(),
    };
    const mw = x402Payment({ ...baseConfig, facilitator: brokenFacilitator });
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
      payload: { signature: "0x123" },
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    const req = mockReq({
      headers: { [HEADER_PAYMENT_SIGNATURE]: encoded },
    });
    const res = mockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe("payment_verification_failed");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 502 when settlement fails at facilitator", async () => {
    const settleFail: FacilitatorClient = {
      verify: vi.fn().mockResolvedValue({ isValid: true }),
      settle: vi.fn().mockRejectedValue(new Error("Network error")),
    };
    const mw = x402Payment({ ...baseConfig, facilitator: settleFail });
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
      payload: { signature: "0x123" },
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    const req = mockReq({
      headers: { [HEADER_PAYMENT_SIGNATURE]: encoded },
    });
    const res = mockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe("payment_settlement_failed");
  });
});
