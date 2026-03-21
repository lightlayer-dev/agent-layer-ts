/**
 * x402 Payment Middleware for Hono.
 *
 * Protects routes with HTTP 402 micropayments using the x402 protocol.
 *
 * @example
 * ```ts
 * import { x402Payment } from "@agent-layer/hono";
 *
 * app.use(x402Payment({
 *   facilitatorUrl: "https://x402.org/facilitator",
 *   routes: {
 *     "GET /api/weather": {
 *       payTo: "0x1234...",
 *       price: "$0.001",
 *       network: "eip155:8453",
 *       description: "Current weather data",
 *     },
 *   },
 * }));
 * ```
 */

import type { Context, Next } from "hono";
import {
  type X402Config,
  type FacilitatorClient,
  HttpFacilitatorClient,
  matchRoute,
  buildPaymentRequired,
  encodePaymentRequired,
  decodePaymentPayload,
  buildRequirements,
  HEADER_PAYMENT_REQUIRED,
  HEADER_PAYMENT_SIGNATURE,
  HEADER_PAYMENT_RESPONSE,
} from "@agent-layer/core/x402";

export type { X402Config, X402RouteConfig } from "@agent-layer/core/x402";

export function x402Payment(config: X402Config) {
  const facilitator: FacilitatorClient =
    config.facilitator ?? new HttpFacilitatorClient(config.facilitatorUrl);

  return async function x402Middleware(c: Context, next: Next): Promise<Response | void> {
    const routeConfig = matchRoute(c.req.method, c.req.path, config.routes);
    if (!routeConfig) {
      await next();
      return;
    }

    const paymentHeader = c.req.header(HEADER_PAYMENT_SIGNATURE);

    if (!paymentHeader) {
      const url = new URL(c.req.url);
      const paymentRequired = buildPaymentRequired(url.toString(), routeConfig);
      const encoded = encodePaymentRequired(paymentRequired);
      c.header(HEADER_PAYMENT_REQUIRED, encoded);
      return c.json(paymentRequired, 402);
    }

    let payload;
    try {
      payload = decodePaymentPayload(paymentHeader);
    } catch {
      const url = new URL(c.req.url);
      const paymentRequired = buildPaymentRequired(
        url.toString(),
        routeConfig,
        "Invalid payment signature format",
      );
      c.header(HEADER_PAYMENT_REQUIRED, encodePaymentRequired(paymentRequired));
      return c.json(paymentRequired, 402);
    }

    const requirements = buildRequirements(routeConfig);

    let verifyResult;
    try {
      verifyResult = await facilitator.verify(payload, requirements);
    } catch {
      return c.json(
        {
          error: "payment_verification_failed",
          message: "Could not verify payment with facilitator",
        },
        502,
      );
    }

    if (!verifyResult.isValid) {
      const url = new URL(c.req.url);
      const paymentRequired = buildPaymentRequired(
        url.toString(),
        routeConfig,
        verifyResult.invalidReason ?? "Payment verification failed",
      );
      c.header(HEADER_PAYMENT_REQUIRED, encodePaymentRequired(paymentRequired));
      return c.json(paymentRequired, 402);
    }

    let settleResult;
    try {
      settleResult = await facilitator.settle(payload, requirements);
    } catch {
      return c.json(
        {
          error: "payment_settlement_failed",
          message: "Could not settle payment with facilitator",
        },
        502,
      );
    }

    if (!settleResult.success) {
      const url = new URL(c.req.url);
      const paymentRequired = buildPaymentRequired(
        url.toString(),
        routeConfig,
        settleResult.errorReason ?? "Payment settlement failed",
      );
      c.header(HEADER_PAYMENT_REQUIRED, encodePaymentRequired(paymentRequired));
      return c.json(paymentRequired, 402);
    }

    const settlementResponse = Buffer.from(
      JSON.stringify(settleResult),
    ).toString("base64");
    c.header(HEADER_PAYMENT_RESPONSE, settlementResponse);

    c.set("x402", {
      payment: payload,
      settlement: settleResult,
      requirements,
    });

    await next();
  };
}
