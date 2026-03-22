/**
 * Framework-agnostic agent auth helpers.
 *
 * Extracts the duplicated oauthDiscoveryDocument and requireAuth logic
 * from Express/Koa/Hono/Fastify into a single, testable module.
 */

import type { AgentAuthConfig, AgentErrorEnvelope } from "./types.js";
import { formatError } from "./errors.js";

/**
 * Generate the OAuth 2.0 discovery document from auth config.
 */
export function buildOauthDiscoveryDocument(
  config: AgentAuthConfig,
): Record<string, unknown> {
  const doc: Record<string, unknown> = {};

  if (config.issuer) doc["issuer"] = config.issuer;
  if (config.authorizationUrl) doc["authorization_endpoint"] = config.authorizationUrl;
  if (config.tokenUrl) doc["token_endpoint"] = config.tokenUrl;
  if (config.scopes) doc["scopes_supported"] = Object.keys(config.scopes);

  return doc;
}

/**
 * Build the WWW-Authenticate header value.
 */
export function buildWwwAuthenticate(
  realm: string,
  scopes?: Record<string, string>,
): string {
  const parts = [`Bearer realm="${realm}"`];
  if (scopes) {
    parts.push(`scope="${Object.keys(scopes).join(" ")}"`);
  }
  return parts.join(", ");
}

/**
 * Result of checking an auth requirement.
 * If `pass` is true, the request is authenticated (has an Authorization header).
 * If `pass` is false, the `wwwAuthenticate` and `envelope` fields describe the 401 response.
 */
export interface RequireAuthResult {
  pass: boolean;
  wwwAuthenticate?: string;
  envelope?: AgentErrorEnvelope;
}

/**
 * Check whether a request has an Authorization header.
 * Returns a result indicating whether to continue or send a 401.
 */
export function checkRequireAuth(
  config: AgentAuthConfig,
  authorizationHeader: string | undefined,
): RequireAuthResult {
  if (authorizationHeader) {
    return { pass: true };
  }

  const realm = config.realm ?? "api";
  const wwwAuthenticate = buildWwwAuthenticate(realm, config.scopes);
  const envelope = formatError({
    code: "authentication_required",
    message: "This endpoint requires authentication.",
    status: 401,
    docs_url: config.authorizationUrl,
  });

  return { pass: false, wwwAuthenticate, envelope };
}
