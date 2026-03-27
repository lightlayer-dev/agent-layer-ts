/**
 * x402 Payment Protocol — Client-side helpers.
 *
 * Utilities for API consumers that need to handle 402 Payment Required
 * responses and automatically retry with payment.
 */

import type { PaymentRequired, PaymentRequirements, PaymentPayload } from "./x402.js";
import { HEADER_PAYMENT_REQUIRED, HEADER_PAYMENT_SIGNATURE } from "./x402.js";

// ── Types ────────────────────────────────────────────────────────────────

/** Minimal wallet signer — signs a payment for the given requirements. */
export interface WalletSigner {
  sign(requirements: PaymentRequirements): Promise<PaymentPayload>;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Check whether a response is a 402 Payment Required. */
export function isPaymentRequired(response: Response): boolean {
  return response.status === 402;
}

/** Decode the PAYMENT-REQUIRED header from a 402 response. Returns null if missing or invalid. */
export function extractPaymentRequirements(
  response: Response,
): PaymentRequired | null {
  const header = response.headers.get(HEADER_PAYMENT_REQUIRED);
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

/**
 * Wrap a fetch function to automatically handle 402 responses.
 *
 * When the wrapped fetch receives a 402 with a PAYMENT-REQUIRED header,
 * it signs a payment using the provided wallet signer and retries the
 * request with a PAYMENT-SIGNATURE header.
 */
export function wrapFetchWithPayment(
  fetchFn: typeof fetch,
  walletSigner: WalletSigner,
): typeof fetch {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const response = await fetchFn(input, init);

    if (!isPaymentRequired(response)) {
      return response;
    }

    const requirements = extractPaymentRequirements(response);
    if (!requirements || requirements.accepts.length === 0) {
      return response;
    }

    // Sign payment for the first accepted payment scheme
    const accepted = requirements.accepts[0];
    const payload = await walletSigner.sign(accepted);
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");

    // Retry with payment header
    const headers = new Headers(init?.headers);
    headers.set(HEADER_PAYMENT_SIGNATURE, encoded);

    return fetchFn(input, { ...init, headers });
  };
}
