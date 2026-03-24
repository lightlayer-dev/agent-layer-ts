/**
 * Framework-agnostic OAuth2 middleware handler.
 *
 * Provides shared logic for OAuth2 Bearer token validation
 * that framework adapters (Express, Hono, Fastify, Koa) call into.
 */

import type { OAuth2Config, DecodedAccessToken, TokenValidationResult } from "./oauth2.js";
import { extractBearerToken, validateAccessToken } from "./oauth2.js";
import { formatError } from "./errors.js";
import type { AgentErrorEnvelope } from "./types.js";

// ── Types ────────────────────────────────────────────────────────────────

export interface OAuth2MiddlewareConfig {
  /** OAuth2 configuration for token validation. */
  oauth2: OAuth2Config;
  /** Scopes required for the protected route. */
  requiredScopes?: string[];
  /** Clock skew tolerance in seconds. Default: 30. */
  clockSkewSeconds?: number;
  /** Custom token validator (for signature verification with JWKS, etc.). */
  customValidator?: (token: string) => Promise<TokenValidationResult>;
}

export interface OAuth2ValidationSuccess {
  pass: true;
  token: DecodedAccessToken;
}

export interface OAuth2ValidationFailure {
  pass: false;
  status: 401 | 403;
  wwwAuthenticate: string;
  envelope: AgentErrorEnvelope;
}

export type OAuth2ValidationResult = OAuth2ValidationSuccess | OAuth2ValidationFailure;

// ── Handler ──────────────────────────────────────────────────────────────

/**
 * Validate an OAuth2 Bearer token from the Authorization header.
 * Returns a structured result the framework adapter can use to allow or deny.
 */
export async function handleOAuth2(
  authorizationHeader: string | undefined,
  config: OAuth2MiddlewareConfig,
): Promise<OAuth2ValidationResult> {
  const rawToken = extractBearerToken(authorizationHeader);

  if (!rawToken) {
    const realm = config.oauth2.issuer ?? "api";
    const scopeStr = config.requiredScopes?.join(" ");
    const wwwAuth = scopeStr
      ? `Bearer realm="${realm}", scope="${scopeStr}"`
      : `Bearer realm="${realm}"`;

    return {
      pass: false,
      status: 401,
      wwwAuthenticate: wwwAuth,
      envelope: formatError({
        code: "authentication_required",
        message: "Bearer token required. Obtain one via the OAuth2 authorization flow.",
        status: 401,
        docs_url: config.oauth2.authorizationEndpoint,
      }),
    };
  }

  // Use custom validator if provided (e.g., JWKS signature verification)
  let result: TokenValidationResult;
  if (config.customValidator) {
    result = await config.customValidator(rawToken);
  } else {
    result = validateAccessToken(
      rawToken,
      config.oauth2,
      config.requiredScopes,
      config.clockSkewSeconds,
    );
  }

  if (!result.valid) {
    const isExpiredOrInvalid = result.error === "token_expired" ||
      result.error === "malformed_token" ||
      result.error === "invalid_issuer" ||
      result.error === "invalid_audience";

    const status = result.error?.startsWith("missing_scopes") ? 403 : 401;

    const code = status === 403 ? "insufficient_scope" : "invalid_token";
    const message = result.error?.startsWith("missing_scopes")
      ? `Insufficient scope. Required: ${config.requiredScopes?.join(", ")}`
      : `Invalid token: ${result.error}`;

    const realm = config.oauth2.issuer ?? "api";
    const wwwAuth = status === 403
      ? `Bearer realm="${realm}", error="insufficient_scope", scope="${config.requiredScopes?.join(" ")}"`
      : `Bearer realm="${realm}", error="invalid_token"`;

    return {
      pass: false,
      status,
      wwwAuthenticate: wwwAuth,
      envelope: formatError({ code, message, status }),
    };
  }

  return { pass: true, token: result.token! };
}
