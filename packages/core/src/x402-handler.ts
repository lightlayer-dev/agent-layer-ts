/**
 * Framework-agnostic x402 payment flow handler.
 *
 * Extracts the duplicated verify/settle flow from all framework adapters.
 */

import type {
  X402Config,
  X402RouteConfig,
  FacilitatorClient,
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
} from "./x402.js";
import {
  HttpFacilitatorClient,
  matchRoute,
  buildPaymentRequired,
  encodePaymentRequired,
  decodePaymentPayload,
  buildRequirements,
  HEADER_PAYMENT_REQUIRED,
  HEADER_PAYMENT_RESPONSE,
} from "./x402.js";

/**
 * Result when the route doesn't require payment — continue normally.
 */
export interface X402Skip {
  action: "skip";
}

/**
 * Result when payment is required or payment failed.
 */
export interface X402PaymentRequired {
  action: "payment_required";
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Result when payment was verified and settled successfully.
 */
export interface X402Success {
  action: "success";
  headers: Record<string, string>;
  payment: PaymentPayload;
  settlement: SettleResponse;
  requirements: PaymentRequirements;
}

/**
 * Result when the facilitator is unreachable or settlement fails.
 */
export interface X402Error {
  action: "error";
  status: number;
  body: { error: string; message: string };
}

export type X402FlowResult =
  | X402Skip
  | X402PaymentRequired
  | X402Success
  | X402Error;

/**
 * Process a complete x402 payment flow.
 *
 * @param method - HTTP method
 * @param path - Request path
 * @param url - Full request URL
 * @param paymentSignatureHeader - Value of the x-payment header
 * @param config - x402 configuration
 */
export async function handleX402(
  method: string,
  path: string,
  url: string,
  paymentSignatureHeader: string | undefined,
  config: X402Config,
): Promise<X402FlowResult> {
  const facilitator: FacilitatorClient =
    config.facilitator ?? new HttpFacilitatorClient(config.facilitatorUrl);

  // Check if this route requires payment
  const routeConfig = matchRoute(method, path, config.routes);
  if (!routeConfig) {
    return { action: "skip" };
  }

  // No payment header — return 402 with requirements
  if (!paymentSignatureHeader) {
    const paymentRequired = buildPaymentRequired(url, routeConfig);
    const encoded = encodePaymentRequired(paymentRequired);
    return {
      action: "payment_required",
      status: 402,
      headers: { [HEADER_PAYMENT_REQUIRED]: encoded },
      body: paymentRequired,
    };
  }

  // Decode payment payload
  let payload: PaymentPayload;
  try {
    payload = decodePaymentPayload(paymentSignatureHeader);
  } catch {
    const paymentRequired = buildPaymentRequired(
      url,
      routeConfig,
      "Invalid payment signature format",
    );
    return {
      action: "payment_required",
      status: 402,
      headers: {
        [HEADER_PAYMENT_REQUIRED]: encodePaymentRequired(paymentRequired),
      },
      body: paymentRequired,
    };
  }

  const requirements = buildRequirements(routeConfig);

  // Verify with facilitator
  let verifyResult;
  try {
    verifyResult = await facilitator.verify(payload, requirements);
  } catch {
    return {
      action: "error",
      status: 502,
      body: {
        error: "payment_verification_failed",
        message: "Could not verify payment with facilitator",
      },
    };
  }

  if (!verifyResult.isValid) {
    const paymentRequired = buildPaymentRequired(
      url,
      routeConfig,
      verifyResult.invalidReason ?? "Payment verification failed",
    );
    return {
      action: "payment_required",
      status: 402,
      headers: {
        [HEADER_PAYMENT_REQUIRED]: encodePaymentRequired(paymentRequired),
      },
      body: paymentRequired,
    };
  }

  // Settle payment
  let settleResult;
  try {
    settleResult = await facilitator.settle(payload, requirements);
  } catch {
    return {
      action: "error",
      status: 502,
      body: {
        error: "payment_settlement_failed",
        message: "Could not settle payment with facilitator",
      },
    };
  }

  if (!settleResult.success) {
    const paymentRequired = buildPaymentRequired(
      url,
      routeConfig,
      settleResult.errorReason ?? "Payment settlement failed",
    );
    return {
      action: "payment_required",
      status: 402,
      headers: {
        [HEADER_PAYMENT_REQUIRED]: encodePaymentRequired(paymentRequired),
      },
      body: paymentRequired,
    };
  }

  // Payment successful
  const settlementResponse = Buffer.from(
    JSON.stringify(settleResult),
  ).toString("base64");

  return {
    action: "success",
    headers: { [HEADER_PAYMENT_RESPONSE]: settlementResponse },
    payment: payload,
    settlement: settleResult,
    requirements,
  };
}
