/**
 * x402 Payment Plugin for Fastify.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
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

  return fp(
    async function x402Plugin(fastify: FastifyInstance) {
      fastify.addHook(
        "onRequest",
        async (request: FastifyRequest, reply: FastifyReply) => {
          const routeConfig = matchRoute(
            request.method,
            request.url,
            config.routes,
          );
          if (!routeConfig) return;

          const paymentHeader = request.headers[
            HEADER_PAYMENT_SIGNATURE
          ] as string | undefined;

          if (!paymentHeader) {
            const paymentRequired = buildPaymentRequired(
              `${request.protocol}://${request.hostname}${request.url}`,
              routeConfig,
            );
            const encoded = encodePaymentRequired(paymentRequired);
            reply
              .status(402)
              .header(HEADER_PAYMENT_REQUIRED, encoded)
              .send(paymentRequired);
            return;
          }

          let payload;
          try {
            payload = decodePaymentPayload(paymentHeader);
          } catch {
            const paymentRequired = buildPaymentRequired(
              `${request.protocol}://${request.hostname}${request.url}`,
              routeConfig,
              "Invalid payment signature format",
            );
            reply
              .status(402)
              .header(
                HEADER_PAYMENT_REQUIRED,
                encodePaymentRequired(paymentRequired),
              )
              .send(paymentRequired);
            return;
          }

          const requirements = buildRequirements(routeConfig);

          let verifyResult;
          try {
            verifyResult = await facilitator.verify(payload, requirements);
          } catch {
            reply.status(502).send({
              error: "payment_verification_failed",
              message: "Could not verify payment with facilitator",
            });
            return;
          }

          if (!verifyResult.isValid) {
            const paymentRequired = buildPaymentRequired(
              `${request.protocol}://${request.hostname}${request.url}`,
              routeConfig,
              verifyResult.invalidReason ?? "Payment verification failed",
            );
            reply
              .status(402)
              .header(
                HEADER_PAYMENT_REQUIRED,
                encodePaymentRequired(paymentRequired),
              )
              .send(paymentRequired);
            return;
          }

          let settleResult;
          try {
            settleResult = await facilitator.settle(payload, requirements);
          } catch {
            reply.status(502).send({
              error: "payment_settlement_failed",
              message: "Could not settle payment with facilitator",
            });
            return;
          }

          if (!settleResult.success) {
            const paymentRequired = buildPaymentRequired(
              `${request.protocol}://${request.hostname}${request.url}`,
              routeConfig,
              settleResult.errorReason ?? "Payment settlement failed",
            );
            reply
              .status(402)
              .header(
                HEADER_PAYMENT_REQUIRED,
                encodePaymentRequired(paymentRequired),
              )
              .send(paymentRequired);
            return;
          }

          const settlementResponse = Buffer.from(
            JSON.stringify(settleResult),
          ).toString("base64");
          reply.header(HEADER_PAYMENT_RESPONSE, settlementResponse);

          (request as any).x402 = {
            payment: payload,
            settlement: settleResult,
            requirements,
          };
        },
      );
    },
    { name: "agent-layer-x402" },
  );
}
