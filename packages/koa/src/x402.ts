/**
 * x402 Payment Middleware for Koa.
 *
 * Protects routes with HTTP 402 micropayments using the x402 protocol.
 *
 * @example
 * ```ts
 * import { x402Payment } from "@agent-layer/koa";
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

import type { Middleware } from "koa";
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

export function x402Payment(config: X402Config): Middleware {
  const facilitator: FacilitatorClient =
    config.facilitator ?? new HttpFacilitatorClient(config.facilitatorUrl);

  return async (ctx, next) => {
    const routeConfig = matchRoute(ctx.method, ctx.path, config.routes);
    if (!routeConfig) {
      await next();
      return;
    }

    const paymentHeader = ctx.get(HEADER_PAYMENT_SIGNATURE) || undefined;

    if (!paymentHeader) {
      const paymentRequired = buildPaymentRequired(
        `${ctx.protocol}://${ctx.host}${ctx.originalUrl}`,
        routeConfig,
      );
      const encoded = encodePaymentRequired(paymentRequired);
      ctx.status = 402;
      ctx.set(HEADER_PAYMENT_REQUIRED, encoded);
      ctx.body = paymentRequired;
      return;
    }

    let payload;
    try {
      payload = decodePaymentPayload(paymentHeader);
    } catch {
      const paymentRequired = buildPaymentRequired(
        `${ctx.protocol}://${ctx.host}${ctx.originalUrl}`,
        routeConfig,
        "Invalid payment signature format",
      );
      ctx.status = 402;
      ctx.set(HEADER_PAYMENT_REQUIRED, encodePaymentRequired(paymentRequired));
      ctx.body = paymentRequired;
      return;
    }

    const requirements = buildRequirements(routeConfig);

    let verifyResult;
    try {
      verifyResult = await facilitator.verify(payload, requirements);
    } catch {
      ctx.status = 502;
      ctx.body = {
        error: "payment_verification_failed",
        message: "Could not verify payment with facilitator",
      };
      return;
    }

    if (!verifyResult.isValid) {
      const paymentRequired = buildPaymentRequired(
        `${ctx.protocol}://${ctx.host}${ctx.originalUrl}`,
        routeConfig,
        verifyResult.invalidReason ?? "Payment verification failed",
      );
      ctx.status = 402;
      ctx.set(HEADER_PAYMENT_REQUIRED, encodePaymentRequired(paymentRequired));
      ctx.body = paymentRequired;
      return;
    }

    let settleResult;
    try {
      settleResult = await facilitator.settle(payload, requirements);
    } catch {
      ctx.status = 502;
      ctx.body = {
        error: "payment_settlement_failed",
        message: "Could not settle payment with facilitator",
      };
      return;
    }

    if (!settleResult.success) {
      const paymentRequired = buildPaymentRequired(
        `${ctx.protocol}://${ctx.host}${ctx.originalUrl}`,
        routeConfig,
        settleResult.errorReason ?? "Payment settlement failed",
      );
      ctx.status = 402;
      ctx.set(HEADER_PAYMENT_REQUIRED, encodePaymentRequired(paymentRequired));
      ctx.body = paymentRequired;
      return;
    }

    const settlementResponse = Buffer.from(
      JSON.stringify(settleResult),
    ).toString("base64");
    ctx.set(HEADER_PAYMENT_RESPONSE, settlementResponse);

    (ctx.state as any).x402 = {
      payment: payload,
      settlement: settleResult,
      requirements,
    };

    await next();
  };
}
