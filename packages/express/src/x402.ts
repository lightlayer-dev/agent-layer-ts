import type { Request, Response, NextFunction, RequestHandler } from "express";
import { type X402Config, handleX402 } from "@agent-layer/core";
import { HEADER_PAYMENT_SIGNATURE } from "@agent-layer/core/x402";

export type { X402Config, X402RouteConfig } from "@agent-layer/core/x402";

export function x402Payment(config: X402Config): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const paymentHeader =
      req.headers[HEADER_PAYMENT_SIGNATURE] as string | undefined;
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const result = await handleX402(req.method, req.path, url, paymentHeader, config);

    switch (result.action) {
      case "skip":
        next();
        return;
      case "payment_required":
        for (const [k, v] of Object.entries(result.headers)) {
          res.set(k, v);
        }
        res.status(result.status).json(result.body);
        return;
      case "error":
        res.status(result.status).json(result.body);
        return;
      case "success":
        for (const [k, v] of Object.entries(result.headers)) {
          res.set(k, v);
        }
        (req as any).x402 = {
          payment: result.payment,
          settlement: result.settlement,
          requirements: result.requirements,
        };
        next();
        return;
    }
  };
}
