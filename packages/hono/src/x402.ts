import type { Context, Next } from "hono";
import { type X402Config, handleX402 } from "@agent-layer/core";
import { HEADER_PAYMENT_SIGNATURE } from "@agent-layer/core/x402";

export type { X402Config, X402RouteConfig } from "@agent-layer/core/x402";

export function x402Payment(config: X402Config) {
  return async function x402Middleware(c: Context, next: Next): Promise<Response | void> {
    const paymentHeader = c.req.header(HEADER_PAYMENT_SIGNATURE);
    const url = new URL(c.req.url).toString();

    const result = await handleX402(c.req.method, c.req.path, url, paymentHeader, config);

    switch (result.action) {
      case "skip":
        await next();
        return;
      case "payment_required":
        for (const [k, v] of Object.entries(result.headers)) {
          c.header(k, v);
        }
        return c.json(result.body, result.status as any);
      case "error":
        return c.json(result.body, result.status as any);
      case "success":
        for (const [k, v] of Object.entries(result.headers)) {
          c.header(k, v);
        }
        c.set("x402", {
          payment: result.payment,
          settlement: result.settlement,
          requirements: result.requirements,
        });
        await next();
        return;
    }
  };
}
