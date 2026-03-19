import { describe, it, expect } from "vitest";
import {
  resolvePrice,
  buildRequirements,
  buildPaymentRequired,
  encodePaymentRequired,
  decodePaymentPayload,
  matchRoute,
  X402_VERSION,
} from "./x402.js";
import type { X402RouteConfig, PaymentPayload } from "./x402.js";

describe("resolvePrice", () => {
  it("parses dollar string", () => {
    expect(resolvePrice("$0.001")).toEqual({ amount: "0.001", asset: "USDC" });
    expect(resolvePrice("$10")).toEqual({ amount: "10", asset: "USDC" });
  });

  it("rejects invalid dollar strings", () => {
    expect(() => resolvePrice("0.001")).toThrow("Invalid price string");
    expect(() => resolvePrice("€5")).toThrow("Invalid price string");
  });

  it("passes through object price", () => {
    const price = { amount: "1000", asset: "WETH" };
    expect(resolvePrice(price)).toEqual(price);
  });
});

describe("buildRequirements", () => {
  const config: X402RouteConfig = {
    payTo: "0xabc",
    price: "$0.01",
    network: "eip155:8453",
    description: "Weather data",
  };

  it("builds correct requirements", () => {
    const req = buildRequirements(config);
    expect(req.scheme).toBe("exact");
    expect(req.network).toBe("eip155:8453");
    expect(req.asset).toBe("USDC");
    expect(req.amount).toBe("0.01");
    expect(req.payTo).toBe("0xabc");
    expect(req.maxTimeoutSeconds).toBe(60);
  });

  it("respects custom scheme and timeout", () => {
    const req = buildRequirements({ ...config, scheme: "upto", maxTimeoutSeconds: 120 });
    expect(req.scheme).toBe("upto");
    expect(req.maxTimeoutSeconds).toBe(120);
  });
});

describe("buildPaymentRequired", () => {
  it("builds 402 response payload", () => {
    const config: X402RouteConfig = {
      payTo: "0xabc",
      price: "$0.01",
      network: "eip155:8453",
      description: "Weather API",
    };
    const pr = buildPaymentRequired("https://api.example.com/weather", config);
    expect(pr.x402Version).toBe(X402_VERSION);
    expect(pr.resource.url).toBe("https://api.example.com/weather");
    expect(pr.resource.description).toBe("Weather API");
    expect(pr.accepts).toHaveLength(1);
    expect(pr.accepts[0].payTo).toBe("0xabc");
  });

  it("includes error message when provided", () => {
    const config: X402RouteConfig = {
      payTo: "0xabc",
      price: "$0.01",
      network: "eip155:8453",
    };
    const pr = buildPaymentRequired("https://example.com", config, "Insufficient payment");
    expect(pr.error).toBe("Insufficient payment");
  });
});

describe("encode/decode round-trip", () => {
  it("encodes PaymentRequired to base64 and decodes PaymentPayload", () => {
    const pr = buildPaymentRequired("https://example.com/api", {
      payTo: "0xabc",
      price: "$0.01",
      network: "eip155:8453",
    });
    const encoded = encodePaymentRequired(pr);
    expect(typeof encoded).toBe("string");
    // Verify it's valid base64
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    expect(decoded.x402Version).toBe(X402_VERSION);
  });

  it("decodes a valid PaymentPayload from base64", () => {
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
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    const decoded = decodePaymentPayload(encoded);
    expect(decoded.x402Version).toBe(1);
    expect(decoded.payload.signature).toBe("0xdeadbeef");
  });

  it("throws on invalid base64", () => {
    expect(() => decodePaymentPayload("not-valid!!!")).toThrow("Invalid PAYMENT-SIGNATURE");
  });
});

describe("matchRoute", () => {
  const routes = {
    "GET /api/weather": { payTo: "0x1", price: "$0.01" as const, network: "eip155:8453" as const },
    "POST /api/generate": { payTo: "0x2", price: "$0.05" as const, network: "eip155:8453" as const },
  };

  it("matches exact method + path", () => {
    expect(matchRoute("GET", "/api/weather", routes)).toBeDefined();
    expect(matchRoute("POST", "/api/generate", routes)).toBeDefined();
  });

  it("returns undefined for non-matching routes", () => {
    expect(matchRoute("GET", "/api/free", routes)).toBeUndefined();
    expect(matchRoute("POST", "/api/weather", routes)).toBeUndefined();
  });

  it("is case-insensitive on method", () => {
    expect(matchRoute("get", "/api/weather", routes)).toBeDefined();
  });
});
