/**
 * x402 Payment Protocol — Core types and helpers for HTTP-native micropayments.
 *
 * Implements the server side of the x402 protocol (https://x402.org):
 * 1. Server declares pricing via PaymentRequirements
 * 2. Unpaid requests receive 402 + PAYMENT-REQUIRED header
 * 3. Client pays and retries with PAYMENT-SIGNATURE header
 * 4. Server verifies payment via facilitator and serves the resource
 *
 * @see https://github.com/coinbase/x402
 */

// ── Constants ────────────────────────────────────────────────────────────

export const X402_VERSION = 1;
export const HEADER_PAYMENT_REQUIRED = "payment-required";
export const HEADER_PAYMENT_SIGNATURE = "payment-signature";
export const HEADER_PAYMENT_RESPONSE = "payment-response";

// ── Types ────────────────────────────────────────────────────────────────

/** A blockchain network identifier (e.g. "eip155:8453" for Base, "solana:mainnet"). */
export type Network = `${string}:${string}`;

/** Pricing — either a dollar string like "$0.01" or explicit amount + asset. */
export type Price =
  | string // e.g. "$0.01" — resolved to USDC by facilitator
  | { amount: string; asset: string; extra?: Record<string, unknown> };

/** What the server requires for payment on a given route. */
export interface PaymentRequirements {
  scheme: string;
  network: Network;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

/** The 402 response body / header payload. */
export interface PaymentRequired {
  x402Version: number;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
}

/** Metadata about the resource being paid for. */
export interface ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}

/** What the client sends back after paying. */
export interface PaymentPayload {
  x402Version: number;
  resource?: ResourceInfo;
  accepted: PaymentRequirements;
  payload: Record<string, unknown>;
}

/** Facilitator verify response. */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
}

/** Facilitator settle response. */
export interface SettleResponse {
  success: boolean;
  txHash?: string;
  network?: string;
  errorReason?: string;
}

// ── Route config ─────────────────────────────────────────────────────────

/** Per-route payment configuration. */
export interface X402RouteConfig {
  /** Blockchain address to receive payment. */
  payTo: string;
  /** Payment scheme (default: "exact"). */
  scheme?: string;
  /** Price for this endpoint. */
  price: Price;
  /** Blockchain network. */
  network: Network;
  /** Max seconds to wait for settlement (default: 60). */
  maxTimeoutSeconds?: number;
  /** Human-readable description of what this endpoint does. */
  description?: string;
  /** Extra scheme-specific data. */
  extra?: Record<string, unknown>;
}

/** Top-level x402 config for the middleware. */
export interface X402Config {
  /** Route → payment config mapping. Keys are "METHOD /path" (e.g. "GET /api/weather"). */
  routes: Record<string, X402RouteConfig>;
  /** Facilitator URL for payment verification and settlement. */
  facilitatorUrl: string;
  /** Custom facilitator client (overrides facilitatorUrl). */
  facilitator?: FacilitatorClient;
}

// ── Facilitator client ───────────────────────────────────────────────────

/** Interface for communicating with an x402 facilitator. */
export interface FacilitatorClient {
  verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse>;
  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse>;
}

/** Default HTTP-based facilitator client. */
export class HttpFacilitatorClient implements FacilitatorClient {
  constructor(private readonly url: string) {}

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const res = await fetch(`${this.url}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, requirements }),
    });
    if (!res.ok) {
      throw new Error(`Facilitator verify failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<VerifyResponse>;
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const res = await fetch(`${this.url}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, requirements }),
    });
    if (!res.ok) {
      throw new Error(`Facilitator settle failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<SettleResponse>;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Resolve a Price into concrete amount + asset. */
export function resolvePrice(price: Price): { amount: string; asset: string; extra?: Record<string, unknown> } {
  if (typeof price === "string") {
    // Dollar string like "$0.01" → amount in minor units, asset = USDC
    const match = price.match(/^\$(\d+(?:\.\d+)?)$/);
    if (!match) throw new Error(`Invalid price string: ${price}. Use "$X.XX" format.`);
    return { amount: match[1], asset: "USDC" };
  }
  return price;
}

/** Build PaymentRequirements from a route config. */
export function buildRequirements(
  config: X402RouteConfig,
): PaymentRequirements {
  const { amount, asset, extra: priceExtra } = resolvePrice(config.price);
  return {
    scheme: config.scheme ?? "exact",
    network: config.network,
    asset,
    amount,
    payTo: config.payTo,
    maxTimeoutSeconds: config.maxTimeoutSeconds ?? 60,
    extra: { ...config.extra, ...priceExtra },
  };
}

/** Build the 402 response payload. */
export function buildPaymentRequired(
  url: string,
  config: X402RouteConfig,
  error?: string,
): PaymentRequired {
  return {
    x402Version: X402_VERSION,
    error,
    resource: {
      url,
      description: config.description,
    },
    accepts: [buildRequirements(config)],
  };
}

/** Encode a PaymentRequired object to a base64 header value. */
export function encodePaymentRequired(pr: PaymentRequired): string {
  return Buffer.from(JSON.stringify(pr)).toString("base64");
}

/** Decode a base64 PAYMENT-SIGNATURE header to a PaymentPayload. */
export function decodePaymentPayload(header: string): PaymentPayload {
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
  } catch {
    throw new Error("Invalid PAYMENT-SIGNATURE header: not valid base64 JSON");
  }
}

/** Match an incoming request to a route config key ("METHOD /path").
 *
 * Supports exact matches ("GET /api/weather") and wildcard patterns
 * ("GET /api/*" matches any path starting with /api/).
 * Exact matches take priority over wildcard matches.
 */
export function matchRoute(
  method: string,
  path: string,
  routes: Record<string, X402RouteConfig>,
): X402RouteConfig | undefined {
  const key = `${method.toUpperCase()} ${path}`;

  // Exact match first (highest priority)
  if (routes[key]) return routes[key];

  // Wildcard matching — find the most specific (longest prefix) match
  const upperMethod = method.toUpperCase();
  let bestMatch: X402RouteConfig | undefined;
  let bestLen = -1;

  for (const pattern of Object.keys(routes)) {
    if (!pattern.endsWith("/*")) continue;
    const [patternMethod, patternPath] = pattern.split(" ", 2);
    if (patternMethod !== upperMethod) continue;

    // "/api/*" → prefix is "/api/"
    const prefix = patternPath.slice(0, -1); // remove trailing "*"
    if (path.startsWith(prefix) && prefix.length > bestLen) {
      bestLen = prefix.length;
      bestMatch = routes[pattern];
    }
  }

  return bestMatch;
}
