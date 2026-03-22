import type { Middleware } from "koa";
import { type X402Config, handleX402 } from "@agent-layer/core";
import { HEADER_PAYMENT_SIGNATURE } from "@agent-layer/core/x402";

export type { X402Config, X402RouteConfig } from "@agent-layer/core/x402";

export function x402Payment(config: X402Config): Middleware {
  return async (ctx, next) => {
    const paymentHeader = ctx.get(HEADER_PAYMENT_SIGNATURE) || undefined;
    const url = `${ctx.protocol}://${ctx.host}${ctx.originalUrl}`;

    const result = await handleX402(ctx.method, ctx.path, url, paymentHeader, config);

    switch (result.action) {
      case "skip":
        await next();
        return;
      case "payment_required":
        ctx.status = result.status;
        for (const [k, v] of Object.entries(result.headers)) {
          ctx.set(k, v);
        }
        ctx.body = result.body;
        return;
      case "error":
        ctx.status = result.status;
        ctx.body = result.body;
        return;
      case "success":
        for (const [k, v] of Object.entries(result.headers)) {
          ctx.set(k, v);
        }
        (ctx.state as any).x402 = {
          payment: result.payment,
          settlement: result.settlement,
          requirements: result.requirements,
        };
        await next();
        return;
    }
  };
}
