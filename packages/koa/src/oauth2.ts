import type { Context, Next } from "koa";
import type { OAuth2Config, DecodedAccessToken } from "@agent-layer/core";
import type { OAuth2MiddlewareConfig } from "@agent-layer/core";
import { handleOAuth2, buildOAuth2Metadata } from "@agent-layer/core";

export interface KoaOAuth2Handlers {
  /** Middleware that validates Bearer tokens and sets ctx.state.oauth2Token. */
  requireToken(requiredScopes?: string[]): (ctx: Context, next: Next) => Promise<void>;
  /** Route handler for OAuth2 Authorization Server Metadata. */
  metadata(ctx: Context): void;
}

/**
 * Create OAuth2 middleware and route handlers for Koa.
 */
export function oauth2Auth(config: OAuth2Config): KoaOAuth2Handlers {
  const metadataDoc = buildOAuth2Metadata(config);

  return {
    requireToken(requiredScopes?: string[]) {
      const mwConfig: OAuth2MiddlewareConfig = {
        oauth2: config,
        requiredScopes,
      };

      return async function oauth2Middleware(
        ctx: Context,
        next: Next,
      ): Promise<void> {
        const result = await handleOAuth2(ctx.headers.authorization, mwConfig);

        if (result.pass) {
          ctx.state.oauth2Token = result.token;
          await next();
          return;
        }

        ctx.set("WWW-Authenticate", result.wwwAuthenticate);
        ctx.status = result.status;
        ctx.body = { error: result.envelope };
      };
    },

    metadata(ctx: Context): void {
      ctx.body = metadataDoc;
    },
  };
}

/**
 * Helper to retrieve the decoded OAuth2 token from Koa context.
 */
export function getOAuth2Token(ctx: Context): DecodedAccessToken | undefined {
  return ctx.state.oauth2Token;
}
