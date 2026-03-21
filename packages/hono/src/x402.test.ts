import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
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

describe("x402Payment middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through requests for non-protected routes", async () => {
    const app = new Hono();
    app.use("*", x402Payment(baseConfig));
    app.get("/api/free", (c) => c.json({ ok: true }));

    const res = await app.request("/api/free");
    expect(res.status).toBe(200);
  });

  it("returns 402 when no payment header is provided", async () => {
    const app = new Hono();
    app.use("*", x402Payment(baseConfig));
    app.get("/api/weather", (c) => c.json({ temp: 72 }));

    const res = await app.request("/api/weather");

    expect(res.status).toBe(402);
    expect(res.headers.get(HEADER_PAYMENT_REQUIRED)).toBeTruthy();
    const body = await res.json() as any;
    expect(body.x402Version).toBe(1);
    expect(body.accepts).toHaveLength(1);
    expect(body.accepts[0].payTo).toBe("0xPayeeAddress");
  });

  it("returns 402 for invalid payment signature format", async () => {
    const app = new Hono();
    app.use("*", x402Payment(baseConfig));
    app.get("/api/weather", (c) => c.json({ temp: 72 }));

    const res = await app.request("/api/weather", {
      headers: { [HEADER_PAYMENT_SIGNATURE]: "not-valid-base64!!!" },
    });

    expect(res.status).toBe(402);
    const body = await res.json() as any;
    expect(body.error).toBe("Invalid payment signature format");
  });

  it("verifies and settles valid payment, then calls next()", async () => {
    const app = new Hono();
    app.use("*", x402Payment(baseConfig));
    app.get("/api/weather", (c) => c.json({ temp: 72 }));

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
    const res = await app.request("/api/weather", {
      headers: { [HEADER_PAYMENT_SIGNATURE]: encoded },
    });

    expect(mockFacilitator.verify).toHaveBeenCalled();
    expect(mockFacilitator.settle).toHaveBeenCalled();
    expect(res.headers.get(HEADER_PAYMENT_RESPONSE)).toBeTruthy();
    expect(res.status).toBe(200);
  });

  it("returns 402 when verification fails", async () => {
    const failFacilitator: FacilitatorClient = {
      verify: vi.fn().mockResolvedValue({ isValid: false, invalidReason: "Signature expired" }),
      settle: vi.fn(),
    };
    const app = new Hono();
    app.use("*", x402Payment({ ...baseConfig, facilitator: failFacilitator }));
    app.get("/api/weather", (c) => c.json({ temp: 72 }));

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
    const res = await app.request("/api/weather", {
      headers: { [HEADER_PAYMENT_SIGNATURE]: encoded },
    });

    expect(res.status).toBe(402);
    const body = await res.json() as any;
    expect(body.error).toBe("Signature expired");
    expect(failFacilitator.settle).not.toHaveBeenCalled();
  });

  it("returns 502 when facilitator is unreachable", async () => {
    const brokenFacilitator: FacilitatorClient = {
      verify: vi.fn().mockRejectedValue(new Error("Connection refused")),
      settle: vi.fn(),
    };
    const app = new Hono();
    app.use("*", x402Payment({ ...baseConfig, facilitator: brokenFacilitator }));
    app.get("/api/weather", (c) => c.json({ temp: 72 }));

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
    const res = await app.request("/api/weather", {
      headers: { [HEADER_PAYMENT_SIGNATURE]: encoded },
    });

    expect(res.status).toBe(502);
    const body = await res.json() as any;
    expect(body.error).toBe("payment_verification_failed");
  });

  it("returns 502 when settlement fails at facilitator", async () => {
    const settleFail: FacilitatorClient = {
      verify: vi.fn().mockResolvedValue({ isValid: true }),
      settle: vi.fn().mockRejectedValue(new Error("Network error")),
    };
    const app = new Hono();
    app.use("*", x402Payment({ ...baseConfig, facilitator: settleFail }));
    app.get("/api/weather", (c) => c.json({ temp: 72 }));

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
    const res = await app.request("/api/weather", {
      headers: { [HEADER_PAYMENT_SIGNATURE]: encoded },
    });

    expect(res.status).toBe(502);
    const body = await res.json() as any;
    expect(body.error).toBe("payment_settlement_failed");
  });
});
