/**
 * Security headers for agent-facing APIs.
 *
 * Sets headers that protect the API without blocking legitimate agent access:
 * - HSTS (Strict-Transport-Security)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Referrer-Policy
 * - Content-Security-Policy
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface SecurityHeadersConfig {
  /** HSTS max-age in seconds. Default: 31536000 (1 year). Set to 0 to disable. */
  hstsMaxAge?: number;
  /** Include subdomains in HSTS. Default: true */
  hstsIncludeSubdomains?: boolean;
  /** X-Frame-Options value. Default: "DENY" */
  frameOptions?: "DENY" | "SAMEORIGIN" | false;
  /** X-Content-Type-Options. Default: "nosniff" */
  contentTypeOptions?: "nosniff" | false;
  /** Referrer-Policy. Default: "strict-origin-when-cross-origin" */
  referrerPolicy?: string | false;
  /** Content-Security-Policy. Default: "default-src 'self'" */
  csp?: string | false;
  /** Permissions-Policy. Default: false (not set) */
  permissionsPolicy?: string | false;
}

export interface SecurityHeaders {
  [key: string]: string;
}

// ── Generator ───────────────────────────────────────────────────────────

/**
 * Generate a map of security headers based on config.
 * Returns a plain object suitable for setting on any HTTP response.
 */
export function generateSecurityHeaders(
  config: SecurityHeadersConfig = {},
): SecurityHeaders {
  const headers: SecurityHeaders = {};

  // HSTS
  const maxAge = config.hstsMaxAge ?? 31536000;
  if (maxAge > 0) {
    const sub = config.hstsIncludeSubdomains !== false ? "; includeSubDomains" : "";
    headers["Strict-Transport-Security"] = `max-age=${maxAge}${sub}`;
  }

  // X-Content-Type-Options
  if (config.contentTypeOptions !== false) {
    headers["X-Content-Type-Options"] = config.contentTypeOptions ?? "nosniff";
  }

  // X-Frame-Options
  if (config.frameOptions !== false) {
    headers["X-Frame-Options"] = config.frameOptions ?? "DENY";
  }

  // Referrer-Policy
  if (config.referrerPolicy !== false) {
    headers["Referrer-Policy"] =
      config.referrerPolicy ?? "strict-origin-when-cross-origin";
  }

  // CSP
  if (config.csp !== false) {
    headers["Content-Security-Policy"] = config.csp ?? "default-src 'self'";
  }

  // Permissions-Policy
  if (config.permissionsPolicy) {
    headers["Permissions-Policy"] = config.permissionsPolicy;
  }

  return headers;
}
