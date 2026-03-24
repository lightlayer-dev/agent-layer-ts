import type { Request, Response, NextFunction } from "express";
import type { OAuth2Config, DecodedAccessToken } from "@agent-layer/core";
import type { OAuth2MiddlewareConfig } from "@agent-layer/core";
import { handleOAuth2, buildOAuth2Metadata } from "@agent-layer/core";

// Extend Express Request to carry decoded token
declare global {
  namespace Express {
    interface Request {
      oauth2Token?: DecodedAccessToken;
    }
  }
}

export interface OAuth2Handlers {
  /** Middleware that validates Bearer tokens and attaches decoded token to req.oauth2Token. */
  requireToken(requiredScopes?: string[]): (req: Request, res: Response, next: NextFunction) => void;
  /** Route handler that serves OAuth2 Authorization Server Metadata (RFC 8414). */
  metadata(req: Request, res: Response): void;
}

/**
 * Create OAuth2 middleware and route handlers for Express.
 */
export function oauth2Auth(config: OAuth2Config): OAuth2Handlers {
  const metadataDoc = buildOAuth2Metadata(config);

  return {
    requireToken(requiredScopes?: string[]) {
      const mwConfig: OAuth2MiddlewareConfig = {
        oauth2: config,
        requiredScopes,
      };

      return function oauth2Middleware(
        req: Request,
        res: Response,
        next: NextFunction,
      ): void {
        handleOAuth2(req.headers.authorization, mwConfig).then((result) => {
          if (result.pass) {
            req.oauth2Token = result.token;
            next();
          } else {
            res.setHeader("WWW-Authenticate", result.wwwAuthenticate);
            res.status(result.status).json({ error: result.envelope });
          }
        }).catch(next);
      };
    },

    metadata(_req: Request, res: Response): void {
      res.json(metadataDoc);
    },
  };
}
