/**
 * Framework-agnostic agent identity verification handler.
 *
 * Extracts the duplicated extractAndVerify, requireIdentity, and
 * optionalIdentity logic from all framework adapters.
 */

import type { AgentIdentityConfig, AgentIdentityClaims, AuthzContext } from "./agent-identity.js";
import {
  decodeJwtClaims,
  extractClaims,
  validateClaims,
  evaluateAuthz,
} from "./agent-identity.js";
import { formatError } from "./errors.js";
import type { AgentErrorEnvelope } from "./types.js";

/**
 * Extract and verify a token from a raw header value.
 * Returns verified claims, or null if extraction/verification fails.
 */
export async function extractAndVerifyToken(
  rawHeader: string | undefined,
  config: AgentIdentityConfig,
): Promise<AgentIdentityClaims | null> {
  if (!rawHeader) return null;

  const prefix = config.tokenPrefix ?? "Bearer";
  const token = rawHeader.startsWith(prefix + " ")
    ? rawHeader.slice(prefix.length + 1)
    : rawHeader;

  if (config.verifyToken) {
    return config.verifyToken(token);
  }

  const payload = decodeJwtClaims(token);
  if (!payload) return null;
  return extractClaims(payload);
}

/**
 * Error result from identity verification.
 */
export interface IdentityError {
  status: number;
  envelope: AgentErrorEnvelope;
}

/**
 * Success result from identity verification.
 */
export interface IdentitySuccess {
  claims: AgentIdentityClaims;
}

/**
 * Full identity verification and authorization flow.
 *
 * This replaces the duplicated `requireIdentity()` logic across all
 * framework adapters. The caller only needs to:
 * 1. Extract the raw header value from the request
 * 2. Call this function
 * 3. If `error` is returned, send the error response
 * 4. If `claims` is returned, attach to request and continue
 */
export async function handleRequireIdentity(
  rawHeader: string | undefined,
  config: AgentIdentityConfig,
  context: AuthzContext,
): Promise<IdentitySuccess | { error: IdentityError }> {
  // Check for missing header
  if (!rawHeader) {
    return {
      error: {
        status: 401,
        envelope: formatError({
          code: "agent_identity_required",
          message: "Agent identity token is required.",
          status: 401,
        }),
      },
    };
  }

  // Extract and verify token
  const claims = await extractAndVerifyToken(rawHeader, config);
  if (!claims) {
    return {
      error: {
        status: 401,
        envelope: formatError({
          code: config.verifyToken ? "verification_failed" : "malformed_token",
          message: config.verifyToken
            ? "Agent identity token verification failed."
            : "Agent identity token is malformed.",
          status: 401,
        }),
      },
    };
  }

  // Validate claims
  const validationError = validateClaims(claims, config);
  if (validationError) {
    const status = validationError.code === "expired_token" ? 401 : 403;
    return {
      error: {
        status,
        envelope: formatError({
          code: validationError.code,
          message: validationError.message,
          status,
        }),
      },
    };
  }

  // Evaluate authorization policies
  if (config.policies && config.policies.length > 0) {
    const authzResult = evaluateAuthz(
      claims,
      context,
      config.policies,
      config.defaultPolicy,
    );

    if (!authzResult.allowed) {
      return {
        error: {
          status: 403,
          envelope: formatError({
            code: "agent_unauthorized",
            message: authzResult.deniedReason ?? "Agent is not authorized.",
            status: 403,
          }),
        },
      };
    }
  }

  return { claims };
}

/**
 * Optional identity extraction — extracts and validates identity if present,
 * but does not reject the request if missing or invalid.
 */
export async function handleOptionalIdentity(
  rawHeader: string | undefined,
  config: AgentIdentityConfig,
): Promise<AgentIdentityClaims | null> {
  if (!rawHeader) return null;

  try {
    const claims = await extractAndVerifyToken(rawHeader, config);
    if (!claims) return null;

    const err = validateClaims(claims, config);
    if (err) return null;

    return claims;
  } catch {
    return null;
  }
}
