/**
 * Agent Identity Module — per IETF draft-klrc-aiagent-auth-00
 *
 * Implements agent identity verification following the AIMS (Agent Identity
 * Management System) model. Treats AI agents as workloads with SPIFFE/WIMSE
 * identifiers, JWT-based credentials, and scoped authorization.
 *
 * Supports:
 * - JWT-based Workload Identity Tokens (WIT) verification
 * - SPIFFE ID extraction and validation
 * - Scoped authorization policies
 * - Audit event generation for the analytics pipeline
 */

// ── Types ────────────────────────────────────────────────────────────────

/** SPIFFE ID in URI form: spiffe://trust-domain/path */
export interface SpiffeId {
  trustDomain: string;
  path: string;
  raw: string;
}

/** Claims extracted from a verified agent identity token. */
export interface AgentIdentityClaims {
  /** Unique agent identifier (WIMSE/SPIFFE URI or opaque ID). */
  agentId: string;
  /** Parsed SPIFFE ID if the identifier is a SPIFFE URI. */
  spiffeId?: SpiffeId;
  /** Issuer of the identity token. */
  issuer: string;
  /** Subject claim. */
  subject: string;
  /** Audience(s) the token is valid for. */
  audience: string[];
  /** Token expiration (Unix seconds). */
  expiresAt: number;
  /** Token issued-at (Unix seconds). */
  issuedAt: number;
  /** Scopes/permissions granted. */
  scopes: string[];
  /** Whether the agent is acting on behalf of a user (delegated). */
  delegated: boolean;
  /** The delegating user/system identifier, if delegated. */
  delegatedBy?: string;
  /** Custom claims preserved for policy evaluation. */
  customClaims: Record<string, unknown>;
}

/** A policy rule for agent authorization. */
export interface AgentAuthzPolicy {
  /** Human-readable policy name. */
  name: string;
  /** Match agent IDs (exact or glob pattern). */
  agentPattern?: string;
  /** Match trust domains. */
  trustDomains?: string[];
  /** Required scopes (all must be present). */
  requiredScopes?: string[];
  /** Allowed HTTP methods. */
  methods?: string[];
  /** Allowed path patterns (glob). */
  paths?: string[];
  /** Whether delegated access is allowed. */
  allowDelegated?: boolean;
  /** Custom predicate for complex rules. */
  evaluate?: (claims: AgentIdentityClaims, context: AuthzContext) => boolean;
}

export interface AuthzContext {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
}

export interface AuthzResult {
  allowed: boolean;
  matchedPolicy?: string;
  deniedReason?: string;
}

/** Configuration for the agent identity module. */
export interface AgentIdentityConfig {
  /** Trusted issuers — only tokens from these issuers are accepted. */
  trustedIssuers: string[];
  /** Expected audience(s). Token must contain at least one. */
  audience: string[];
  /** JWKS endpoints keyed by issuer URL. If not set, uses issuer + /.well-known/jwks.json */
  jwksEndpoints?: Record<string, string>;
  /** Trusted SPIFFE trust domains. If set, only these domains are accepted. */
  trustedDomains?: string[];
  /** Authorization policies (evaluated in order, first match wins). */
  policies?: AgentAuthzPolicy[];
  /** Default policy when no rule matches: "deny" (default) or "allow". */
  defaultPolicy?: "allow" | "deny";
  /** Custom token verification function (for testing or custom JWT libs). */
  verifyToken?: (token: string) => Promise<AgentIdentityClaims | null>;
  /** Header name for the agent identity token. Default: "Authorization". */
  headerName?: string;
  /** Token prefix. Default: "Bearer". */
  tokenPrefix?: string;
  /** Clock skew tolerance in seconds. Default: 30. */
  clockSkewSeconds?: number;
  /** Max token lifetime in seconds. Tokens with longer lifetime are rejected. Default: 3600. */
  maxLifetimeSeconds?: number;
}

// ── SPIFFE ID Parser ─────────────────────────────────────────────────────

const SPIFFE_RE = /^spiffe:\/\/([^/]+)(\/.*)?$/;

/**
 * Parse a SPIFFE ID URI.
 * Returns null if the string is not a valid SPIFFE ID.
 */
export function parseSpiffeId(uri: string): SpiffeId | null {
  const m = SPIFFE_RE.exec(uri);
  if (!m) return null;
  return {
    trustDomain: m[1],
    path: m[2] ?? "/",
    raw: uri,
  };
}

/**
 * Validate a SPIFFE ID against a list of trusted domains.
 */
export function isSpiffeTrusted(
  spiffeId: SpiffeId,
  trustedDomains: string[],
): boolean {
  return trustedDomains.includes(spiffeId.trustDomain);
}

// ── JWT Decoding (base64url) ─────────────────────────────────────────────

function base64urlDecode(str: string): string {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return typeof atob === "function"
    ? atob(base64)
    : Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Decode JWT claims WITHOUT verification (for inspection only).
 * Use verifyToken for actual validation.
 */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(base64urlDecode(parts[1]));
  } catch {
    return null;
  }
}

// ── Claims Extraction ────────────────────────────────────────────────────

const KNOWN_CLAIMS = new Set([
  "iss", "sub", "aud", "exp", "iat", "nbf", "jti",
  "scope", "scopes", "scp", "act", "agent_id",
]);

/**
 * Extract AgentIdentityClaims from raw JWT payload.
 */
export function extractClaims(
  payload: Record<string, unknown>,
): AgentIdentityClaims {
  const iss = String(payload.iss ?? "");
  const sub = String(payload.sub ?? "");

  // Agent ID: prefer explicit agent_id, then sub
  const agentId = String(payload.agent_id ?? payload.sub ?? "");

  // Parse SPIFFE ID from agent identifier
  const spiffeId = parseSpiffeId(agentId) ?? undefined;

  // Audience normalization
  const rawAud = payload.aud;
  const audience = Array.isArray(rawAud)
    ? rawAud.map(String)
    : rawAud
      ? [String(rawAud)]
      : [];

  // Scopes: support "scope" (space-delimited string), "scopes" (array), "scp" (array)
  let scopes: string[] = [];
  if (typeof payload.scope === "string") {
    scopes = payload.scope.split(" ").filter(Boolean);
  } else if (Array.isArray(payload.scopes)) {
    scopes = payload.scopes.map(String);
  } else if (Array.isArray(payload.scp)) {
    scopes = payload.scp.map(String);
  }

  // Delegation detection (OAuth 2.0 actor claim)
  const delegated = payload.act != null;
  const delegatedBy = delegated
    ? String((payload.act as Record<string, unknown>)?.sub ?? "")
    : undefined;

  // Collect custom claims
  const customClaims: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!KNOWN_CLAIMS.has(k)) customClaims[k] = v;
  }

  return {
    agentId,
    spiffeId,
    issuer: iss,
    subject: sub,
    audience,
    expiresAt: Number(payload.exp ?? 0),
    issuedAt: Number(payload.iat ?? 0),
    scopes,
    delegated,
    delegatedBy: delegatedBy || undefined,
    customClaims,
  };
}

// ── Token Validation ─────────────────────────────────────────────────────

export interface TokenValidationError {
  code:
    | "missing_token"
    | "malformed_token"
    | "untrusted_issuer"
    | "invalid_audience"
    | "expired_token"
    | "token_too_long_lived"
    | "untrusted_domain"
    | "verification_failed";
  message: string;
}

/**
 * Validate extracted claims against the identity config.
 * Returns null if valid, or a TokenValidationError.
 */
export function validateClaims(
  claims: AgentIdentityClaims,
  config: AgentIdentityConfig,
): TokenValidationError | null {
  const now = Math.floor(Date.now() / 1000);
  const skew = config.clockSkewSeconds ?? 30;

  // Check issuer
  if (!config.trustedIssuers.includes(claims.issuer)) {
    return {
      code: "untrusted_issuer",
      message: `Issuer "${claims.issuer}" is not trusted.`,
    };
  }

  // Check audience
  const audMatch = claims.audience.some((a) => config.audience.includes(a));
  if (!audMatch && claims.audience.length > 0) {
    return {
      code: "invalid_audience",
      message: "Token audience does not match any expected audience.",
    };
  }

  // Check expiration
  if (claims.expiresAt && claims.expiresAt + skew < now) {
    return {
      code: "expired_token",
      message: "Token has expired.",
    };
  }

  // Check max lifetime (short-lived credential requirement per IETF draft)
  const maxLifetime = config.maxLifetimeSeconds ?? 3600;
  if (claims.issuedAt && claims.expiresAt) {
    const lifetime = claims.expiresAt - claims.issuedAt;
    if (lifetime > maxLifetime) {
      return {
        code: "token_too_long_lived",
        message: `Token lifetime ${lifetime}s exceeds maximum ${maxLifetime}s.`,
      };
    }
  }

  // Check SPIFFE trust domain
  if (claims.spiffeId && config.trustedDomains) {
    if (!isSpiffeTrusted(claims.spiffeId, config.trustedDomains)) {
      return {
        code: "untrusted_domain",
        message: `SPIFFE trust domain "${claims.spiffeId.trustDomain}" is not trusted.`,
      };
    }
  }

  return null;
}

// ── Authorization ────────────────────────────────────────────────────────

/**
 * Simple glob match: supports * wildcard.
 */
function globMatch(pattern: string, value: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
  );
  return regex.test(value);
}

/**
 * Evaluate authorization policies against verified claims.
 */
export function evaluateAuthz(
  claims: AgentIdentityClaims,
  context: AuthzContext,
  policies: AgentAuthzPolicy[],
  defaultPolicy: "allow" | "deny" = "deny",
): AuthzResult {
  for (const policy of policies) {
    // Match agent pattern
    if (policy.agentPattern && !globMatch(policy.agentPattern, claims.agentId)) {
      continue;
    }

    // Match trust domain
    if (policy.trustDomains && claims.spiffeId) {
      if (!policy.trustDomains.includes(claims.spiffeId.trustDomain)) continue;
    }

    // Match method
    if (policy.methods && !policy.methods.includes(context.method.toUpperCase())) {
      continue;
    }

    // Match path
    if (policy.paths) {
      const pathMatch = policy.paths.some((p) => globMatch(p, context.path));
      if (!pathMatch) continue;
    }

    // Check delegation
    if (policy.allowDelegated === false && claims.delegated) {
      return {
        allowed: false,
        matchedPolicy: policy.name,
        deniedReason: "Delegated access not allowed by policy.",
      };
    }

    // Check required scopes
    if (policy.requiredScopes) {
      const missing = policy.requiredScopes.filter((s) => !claims.scopes.includes(s));
      if (missing.length > 0) {
        return {
          allowed: false,
          matchedPolicy: policy.name,
          deniedReason: `Missing required scopes: ${missing.join(", ")}`,
        };
      }
    }

    // Custom evaluator
    if (policy.evaluate && !policy.evaluate(claims, context)) {
      return {
        allowed: false,
        matchedPolicy: policy.name,
        deniedReason: "Custom policy evaluation denied access.",
      };
    }

    // All checks passed
    return { allowed: true, matchedPolicy: policy.name };
  }

  // No policy matched — use default
  return {
    allowed: defaultPolicy === "allow",
    deniedReason:
      defaultPolicy === "deny" ? "No matching authorization policy." : undefined,
  };
}

// ── Audit Event ──────────────────────────────────────────────────────────

export interface AgentIdentityAuditEvent {
  type: "agent_identity";
  timestamp: string;
  agentId: string;
  spiffeId?: string;
  issuer: string;
  delegated: boolean;
  delegatedBy?: string;
  scopes: string[];
  method: string;
  path: string;
  authzResult: AuthzResult;
}

/**
 * Build an audit event from identity verification results.
 */
export function buildAuditEvent(
  claims: AgentIdentityClaims,
  context: AuthzContext,
  authzResult: AuthzResult,
): AgentIdentityAuditEvent {
  return {
    type: "agent_identity",
    timestamp: new Date().toISOString(),
    agentId: claims.agentId,
    spiffeId: claims.spiffeId?.raw,
    issuer: claims.issuer,
    delegated: claims.delegated,
    delegatedBy: claims.delegatedBy,
    scopes: claims.scopes,
    method: context.method,
    path: context.path,
    authzResult,
  };
}
