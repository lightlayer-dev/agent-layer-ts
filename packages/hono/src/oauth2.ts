import type { Context, Next } from "hono";
import type { OAuth2Config, DecodedAccessToken } from "@agent-layer/core";
import type { OAuth2MiddlewareConfig } from "@agent-layer/core";
import { handleOAuth2, buildOAuth2Metadata } from "@agent-layer/core";

/** Key for storing decoded token in Hono context variables. */
const OAUTH2_TOKEN_KEY = "oauth2Token";

export interface HonoOAuth2Handlers {
  /** Middleware that validates Bearer tokens and sets context variable. */
  requireToken(requiredScopes?: string[]): (c: Context, next: Next) => Promise<Response | void>;
  /** Route handler for OAuth2 Authorization Server Metadata. */
  metadata(c: Context): Response;
}

/**
 * Create OAuth2 middleware and route handlers for Hono.
 */
export function oauth2Auth(config: OAuth2Config): HonoOAuth2Handlers {
  const metadataDoc = buildOAuth2Metadata(config);

  return {
    requireToken(requiredScopes?: string[]) {
      const mwConfig: OAuth2MiddlewareConfig = {
        oauth2: config,
        requiredScopes,
      };

      return async function oauth2Middleware(
        c: Context,
        next: Next,
      ): Promise<Response | void> {
        const result = await handleOAuth2(c.req.header("authorization"), mwConfig);

        if (result.pass) {
          c.set(OAUTH2_TOKEN_KEY, result.token);
          await next();
          return;
        }

        c.header("WWW-Authenticate", result.wwwAuthenticate);
        return c.json({ error: result.envelope }, result.status);
      };
    },

    metadata(c: Context): Response {
      return c.json(metadataDoc);
    },
  };
}

/**
 * Helper to retrieve the decoded OAuth2 token from Hono context.
 */
export function getOAuth2Token(c: Context): DecodedAccessToken | undefined {
  return c.get(OAUTH2_TOKEN_KEY);
}
