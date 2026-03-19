/**
 * x402 Payment Middleware for Express.
 *
 * Protects routes with HTTP 402 micropayments using the x402 protocol.
 * Works alongside other agent-layer middleware (rate limiting, analytics, etc.).
 *
 * @example
 * ```ts
 * import { x402Payment } from "@agent-layer/express";
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

import type { Request, Response, NextFunction, RequestHandler } from "express";
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

export function x402Payment(config: X402Config): RequestHandler {
  const facilitator: FacilitatorClient =
    config.facilitator ?? new HttpFacilitatorClient(config.facilitatorUrl);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Check if this route requires payment
    const routeConfig = matchRoute(req.method, req.path, config.routes);
    if (!routeConfig) {
      next();
      return;
    }

    // Check for payment signature header
    const paymentHeader =
      req.headers[HEADER_PAYMENT_SIGNATURE] as string | undefined;

    if (!paymentHeader) {
      // No payment — return 402 with requirements
      const paymentRequired = buildPaymentRequired(
        `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        routeConfig,
      );
      const encoded = encodePaymentRequired(paymentRequired);
      res
        .status(402)
        .set(HEADER_PAYMENT_REQUIRED, encoded)
        .json(paymentRequired);
      return;
    }

    // Decode and verify payment
    let payload;
    try {
      payload = decodePaymentPayload(paymentHeader);
    } catch (err) {
      const paymentRequired = buildPaymentRequired(
        `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        routeConfig,
        "Invalid payment signature format",
      );
      res
        .status(402)
        .set(HEADER_PAYMENT_REQUIRED, encodePaymentRequired(paymentRequired))
        .json(paymentRequired);
      return;
    }

    const requirements = buildRequirements(routeConfig);

    // Verify with facilitator
    let verifyResult;
    try {
      verifyResult = await facilitator.verify(payload, requirements);
    } catch (err) {
      res.status(502).json({
        error: "payment_verification_failed",
        message: "Could not verify payment with facilitator",
      });
      return;
    }

    if (!verifyResult.isValid) {
      const paymentRequired = buildPaymentRequired(
        `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        routeConfig,
        verifyResult.invalidReason ?? "Payment verification failed",
      );
      res
        .status(402)
        .set(HEADER_PAYMENT_REQUIRED, encodePaymentRequired(paymentRequired))
        .json(paymentRequired);
      return;
    }

    // Settle payment
    let settleResult;
    try {
      settleResult = await facilitator.settle(payload, requirements);
    } catch (err) {
      res.status(502).json({
        error: "payment_settlement_failed",
        message: "Could not settle payment with facilitator",
      });
      return;
    }

    if (!settleResult.success) {
      const paymentRequired = buildPaymentRequired(
        `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        routeConfig,
        settleResult.errorReason ?? "Payment settlement failed",
      );
      res
        .status(402)
        .set(HEADER_PAYMENT_REQUIRED, encodePaymentRequired(paymentRequired))
        .json(paymentRequired);
      return;
    }

    // Payment successful — attach settlement info to response header
    const settlementResponse = Buffer.from(
      JSON.stringify(settleResult),
    ).toString("base64");
    res.set(HEADER_PAYMENT_RESPONSE, settlementResponse);

    // Attach payment info to request for downstream handlers
    (req as any).x402 = {
      payment: payload,
      settlement: settleResult,
      requirements,
    };

    next();
  };
}
