import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { type X402Config, handleX402 } from "@agent-layer/core";
import { HEADER_PAYMENT_SIGNATURE } from "@agent-layer/core/x402";

export type { X402Config, X402RouteConfig } from "@agent-layer/core/x402";

export function x402Payment(config: X402Config) {
  return fp(
    async function x402Plugin(fastify: FastifyInstance) {
      fastify.addHook(
        "onRequest",
        async (request: FastifyRequest, reply: FastifyReply) => {
          const paymentHeader = request.headers[
            HEADER_PAYMENT_SIGNATURE
          ] as string | undefined;
          const url = `${request.protocol}://${request.hostname}${request.url}`;

          const result = await handleX402(
            request.method,
            request.url,
            url,
            paymentHeader,
            config,
          );

          switch (result.action) {
            case "skip":
              return;
            case "payment_required":
              for (const [k, v] of Object.entries(result.headers)) {
                reply.header(k, v);
              }
              reply.status(result.status).send(result.body);
              return;
            case "error":
              reply.status(result.status).send(result.body);
              return;
            case "success":
              for (const [k, v] of Object.entries(result.headers)) {
                reply.header(k, v);
              }
              (request as any).x402 = {
                payment: result.payment,
                settlement: result.settlement,
                requirements: result.requirements,
              };
              return;
          }
        },
      );
    },
    { name: "agent-layer-x402" },
  );
}
