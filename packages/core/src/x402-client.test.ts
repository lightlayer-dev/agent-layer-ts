import { describe, it, expect, vi } from "vitest";
import {
  isPaymentRequired,
  extractPaymentRequirements,
  wrapFetchWithPayment,
} from "./x402-client.js";
import type { WalletSigner } from "./x402-client.js";
import type { PaymentRequired, PaymentPayload } from "./x402.js";
import { HEADER_PAYMENT_REQUIRED, HEADER_PAYMENT_SIGNATURE } from "./x402.js";

// ── Helpers ──────────────────────────────────────────────────────────────

function make402Response(pr: PaymentRequired): Response {
  const encoded = Buffer.from(JSON.stringify(pr)).toString("base64");
  return new Response(JSON.stringify(pr), {
    status: 402,
    headers: { [HEADER_PAYMENT_REQUIRED]: encoded },
  });
}

const samplePaymentRequired: PaymentRequired = {
  x402Version: 1,
  resource: { url: "https://example.com/api/data" },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:8453",
      asset: "USDC",
      amount: "0.01",
      payTo: "0xabc",
      maxTimeoutSeconds: 60,
      extra: {},
    },
  ],
};

function mockSigner(): WalletSigner {
  const payload: PaymentPayload = {
    x402Version: 1,
    accepted: samplePaymentRequired.accepts[0],
    payload: { signature: "0xsigned" },
  };
  return { sign: vi.fn().mockResolvedValue(payload) };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("isPaymentRequired", () => {
  it("returns true for 402 status", () => {
    expect(isPaymentRequired(new Response(null, { status: 402 }))).toBe(true);
  });

  it("returns false for other statuses", () => {
    expect(isPaymentRequired(new Response(null, { status: 200 }))).toBe(false);
    expect(isPaymentRequired(new Response(null, { status: 401 }))).toBe(false);
  });
});

describe("extractPaymentRequirements", () => {
  it("decodes PAYMENT-REQUIRED header from a 402 response", () => {
    const response = make402Response(samplePaymentRequired);
    const result = extractPaymentRequirements(response);
    expect(result).not.toBeNull();
    expect(result!.x402Version).toBe(1);
    expect(result!.accepts[0].payTo).toBe("0xabc");
  });

  it("returns null when header is missing", () => {
    const response = new Response(null, { status: 402 });
    expect(extractPaymentRequirements(response)).toBeNull();
  });

  it("returns null when header is invalid base64", () => {
    const response = new Response(null, {
      status: 402,
      headers: { [HEADER_PAYMENT_REQUIRED]: "not-valid!!!" },
    });
    expect(extractPaymentRequirements(response)).toBeNull();
  });
});

describe("wrapFetchWithPayment", () => {
  it("passes through non-402 responses unchanged", async () => {
    const okResponse = new Response("ok", { status: 200 });
    const mockFetch = vi.fn().mockResolvedValue(okResponse);
    const signer = mockSigner();
    const wrappedFetch = wrapFetchWithPayment(mockFetch, signer);

    const result = await wrappedFetch("https://example.com/api/data");

    expect(result).toBe(okResponse);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it("signs payment and retries on 402", async () => {
    const paymentResponse = make402Response(samplePaymentRequired);
    const successResponse = new Response("paid content", { status: 200 });
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(paymentResponse)
      .mockResolvedValueOnce(successResponse);
    const signer = mockSigner();
    const wrappedFetch = wrapFetchWithPayment(mockFetch, signer);

    const result = await wrappedFetch("https://example.com/api/data");

    expect(result).toBe(successResponse);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(signer.sign).toHaveBeenCalledOnce();
    expect(signer.sign).toHaveBeenCalledWith(samplePaymentRequired.accepts[0]);

    // Verify second call includes payment header
    const retryCall = mockFetch.mock.calls[1];
    const retryHeaders = new Headers(retryCall[1]?.headers);
    expect(retryHeaders.get(HEADER_PAYMENT_SIGNATURE)).toBeTruthy();
  });

  it("returns 402 as-is when no PAYMENT-REQUIRED header", async () => {
    const bare402 = new Response(null, { status: 402 });
    const mockFetch = vi.fn().mockResolvedValue(bare402);
    const signer = mockSigner();
    const wrappedFetch = wrapFetchWithPayment(mockFetch, signer);

    const result = await wrappedFetch("https://example.com");

    expect(result).toBe(bare402);
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it("returns 402 as-is when accepts array is empty", async () => {
    const emptyAccepts: PaymentRequired = { ...samplePaymentRequired, accepts: [] };
    const response = make402Response(emptyAccepts);
    const mockFetch = vi.fn().mockResolvedValue(response);
    const signer = mockSigner();
    const wrappedFetch = wrapFetchWithPayment(mockFetch, signer);

    const result = await wrappedFetch("https://example.com");

    expect(result).toBe(response);
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it("preserves existing request headers on retry", async () => {
    const paymentResponse = make402Response(samplePaymentRequired);
    const successResponse = new Response("ok", { status: 200 });
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(paymentResponse)
      .mockResolvedValueOnce(successResponse);
    const signer = mockSigner();
    const wrappedFetch = wrapFetchWithPayment(mockFetch, signer);

    await wrappedFetch("https://example.com/api/data", {
      headers: { Authorization: "Bearer tok" },
    });

    const retryHeaders = new Headers(mockFetch.mock.calls[1][1]?.headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer tok");
    expect(retryHeaders.get(HEADER_PAYMENT_SIGNATURE)).toBeTruthy();
  });
});
