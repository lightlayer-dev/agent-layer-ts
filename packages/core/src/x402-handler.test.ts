import { describe, it, expect, vi } from "vitest";
import { handleX402 } from "./x402-handler.js";
import type {
  FacilitatorClient,
  X402Config,
  PaymentPayload,
  PaymentRequired,
} from "./x402.js";
import { HEADER_PAYMENT_REQUIRED, HEADER_PAYMENT_RESPONSE } from "./x402.js";

// ── Helpers ──────────────────────────────────────────────────────────────

const routeConfig = {
  payTo: "0xabc",
  price: "$0.01" as const,
  network: "eip155:8453" as const,
  description: "Test endpoint",
};

function makeConfig(facilitator: FacilitatorClient): X402Config {
  return {
    routes: { "GET /api/data": routeConfig },
    facilitatorUrl: "https://facilitator.test",
    facilitator,
  };
}

function makePaymentHeader(): string {
  const payload: PaymentPayload = {
    x402Version: 1,
    accepted: {
      scheme: "exact",
      network: "eip155:8453",
      asset: "USDC",
      amount: "0.01",
      payTo: "0xabc",
      maxTimeoutSeconds: 60,
      extra: {},
    },
    payload: { signature: "0xdeadbeef" },
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function mockFacilitator(overrides?: Partial<FacilitatorClient>): FacilitatorClient {
  return {
    verify: vi.fn().mockResolvedValue({ isValid: true }),
    settle: vi.fn().mockResolvedValue({ success: true, txHash: "0xtx" }),
    ...overrides,
  };
}

function decodePaymentRequired(result: { headers: Record<string, string> }): PaymentRequired {
  return JSON.parse(
    Buffer.from(result.headers[HEADER_PAYMENT_REQUIRED], "base64").toString("utf-8"),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("handleX402", () => {
  it("returns 402 when route requires payment but no header is present", async () => {
    const facilitator = mockFacilitator();
    const result = await handleX402(
      "GET",
      "/api/data",
      "https://example.com/api/data",
      undefined,
      makeConfig(facilitator),
    );

    expect(result.action).toBe("payment_required");
    if (result.action !== "payment_required") return;
    expect(result.status).toBe(402);
    expect(result.headers[HEADER_PAYMENT_REQUIRED]).toBeDefined();
    const body = result.body as PaymentRequired;
    expect(body.accepts).toHaveLength(1);
    expect(body.accepts[0].payTo).toBe("0xabc");
    expect(facilitator.verify).not.toHaveBeenCalled();
  });

  it("returns skip when route does NOT require payment", async () => {
    const facilitator = mockFacilitator();
    const result = await handleX402(
      "GET",
      "/api/free",
      "https://example.com/api/free",
      undefined,
      makeConfig(facilitator),
    );

    expect(result.action).toBe("skip");
  });

  it("returns success when verify and settle both succeed", async () => {
    const facilitator = mockFacilitator();
    const result = await handleX402(
      "GET",
      "/api/data",
      "https://example.com/api/data",
      makePaymentHeader(),
      makeConfig(facilitator),
    );

    expect(result.action).toBe("success");
    if (result.action !== "success") return;
    expect(result.headers[HEADER_PAYMENT_RESPONSE]).toBeDefined();
    expect(result.settlement.txHash).toBe("0xtx");
    expect(result.payment.payload.signature).toBe("0xdeadbeef");
    expect(facilitator.verify).toHaveBeenCalledOnce();
    expect(facilitator.settle).toHaveBeenCalledOnce();
  });

  it("returns 402 when verify fails (isValid = false)", async () => {
    const facilitator = mockFacilitator({
      verify: vi.fn().mockResolvedValue({ isValid: false, invalidReason: "Expired" }),
    });
    const result = await handleX402(
      "GET",
      "/api/data",
      "https://example.com/api/data",
      makePaymentHeader(),
      makeConfig(facilitator),
    );

    expect(result.action).toBe("payment_required");
    if (result.action !== "payment_required") return;
    expect(result.status).toBe(402);
    const pr = decodePaymentRequired(result);
    expect(pr.error).toBe("Expired");
  });

  it("returns 402 when settle fails (success = false)", async () => {
    const facilitator = mockFacilitator({
      settle: vi.fn().mockResolvedValue({ success: false, errorReason: "Insufficient funds" }),
    });
    const result = await handleX402(
      "GET",
      "/api/data",
      "https://example.com/api/data",
      makePaymentHeader(),
      makeConfig(facilitator),
    );

    expect(result.action).toBe("payment_required");
    if (result.action !== "payment_required") return;
    expect(result.status).toBe(402);
    const pr = decodePaymentRequired(result);
    expect(pr.error).toBe("Insufficient funds");
  });

  it("returns 402 with error on invalid base64 payment header", async () => {
    const facilitator = mockFacilitator();
    const result = await handleX402(
      "GET",
      "/api/data",
      "https://example.com/api/data",
      "not-valid-base64!!!",
      makeConfig(facilitator),
    );

    expect(result.action).toBe("payment_required");
    if (result.action !== "payment_required") return;
    expect(result.status).toBe(402);
    const pr = decodePaymentRequired(result);
    expect(pr.error).toBe("Invalid payment signature format");
  });

  it("returns 502 when facilitator is unreachable on verify", async () => {
    const facilitator = mockFacilitator({
      verify: vi.fn().mockRejectedValue(new Error("Network error")),
    });
    const result = await handleX402(
      "GET",
      "/api/data",
      "https://example.com/api/data",
      makePaymentHeader(),
      makeConfig(facilitator),
    );

    expect(result.action).toBe("error");
    if (result.action !== "error") return;
    expect(result.status).toBe(502);
    expect(result.body.error).toBe("payment_verification_failed");
  });

  it("returns 502 when facilitator is unreachable on settle", async () => {
    const facilitator = mockFacilitator({
      settle: vi.fn().mockRejectedValue(new Error("Network error")),
    });
    const result = await handleX402(
      "GET",
      "/api/data",
      "https://example.com/api/data",
      makePaymentHeader(),
      makeConfig(facilitator),
    );

    expect(result.action).toBe("error");
    if (result.action !== "error") return;
    expect(result.status).toBe(502);
    expect(result.body.error).toBe("payment_settlement_failed");
  });
});
