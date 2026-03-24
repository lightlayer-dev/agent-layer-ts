/**
 * OAuth2 Authorization Code Flow with PKCE
 *
 * Provides framework-agnostic OAuth2 utilities for agent authentication:
 * - PKCE code verifier/challenge generation
 * - Authorization URL construction
 * - Token exchange and refresh
 * - Token validation with scope checking
 *
 * No external dependencies — uses Web Crypto API (Node 18+).
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface OAuth2Config {
  /** OAuth2 client ID. */
  clientId: string;
  /** OAuth2 client secret (for confidential clients). */
  clientSecret?: string;
  /** Authorization endpoint URL. */
  authorizationEndpoint: string;
  /** Token endpoint URL. */
  tokenEndpoint: string;
  /** Redirect URI after authorization. */
  redirectUri: string;
  /** Available scopes with descriptions. */
  scopes?: Record<string, string>;
  /** Token TTL in seconds. Default: 3600. */
  tokenTTL?: number;
  /** Issuer URL for token validation. */
  issuer?: string;
  /** Expected audience for token validation. */
  audience?: string;
}

export interface TokenResponse {
  /** Access token. */
  access_token: string;
  /** Token type (always "Bearer"). */
  token_type: "Bearer";
  /** Seconds until the access token expires. */
  expires_in: number;
  /** Refresh token (if issued). */
  refresh_token?: string;
  /** Space-delimited list of granted scopes. */
  scope?: string;
}

export interface PKCEPair {
  /** Random code verifier (43-128 chars, unreserved URI chars). */
  codeVerifier: string;
  /** Base64url-encoded SHA-256 hash of the verifier. */
  codeChallenge: string;
}

export interface OAuth2Error {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export interface DecodedAccessToken {
  /** Subject (user or agent ID). */
  sub: string;
  /** Issuer. */
  iss?: string;
  /** Audience. */
  aud?: string | string[];
  /** Expiration (Unix seconds). */
  exp: number;
  /** Issued at (Unix seconds). */
  iat?: number;
  /** Granted scopes. */
  scopes: string[];
  /** OAuth2 client ID. */
  client_id?: string;
  /** All claims. */
  claims: Record<string, unknown>;
}

export interface TokenValidationResult {
  valid: boolean;
  token?: DecodedAccessToken;
  error?: string;
}

/**
 * Pluggable HTTP client for token exchange.
 * Keeps the core library framework-agnostic.
 */
export interface OAuth2HttpClient {
  post(url: string, body: URLSearchParams, headers?: Record<string, string>): Promise<{
    status: number;
    json(): Promise<unknown>;
  }>;
}

// ── PKCE ─────────────────────────────────────────────────────────────────

/** Characters allowed in code_verifier (RFC 7636 §4.1). */
const UNRESERVED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/**
 * Generate a cryptographically random code verifier.
 * Length defaults to 64 characters (well within the 43-128 range).
 */
export function generateCodeVerifier(length = 64): string {
  const bytes = new Uint8Array(length);
  (globalThis as any).crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => UNRESERVED[b % UNRESERVED.length]).join("");
}

/**
 * Compute the S256 code challenge from a code verifier.
 * Returns a base64url-encoded SHA-256 hash.
 */
export async function computeCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await (globalThis as any).crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(new Uint8Array(hash));
}

/**
 * Generate a PKCE code verifier + code challenge pair.
 */
export async function generatePKCE(verifierLength = 64): Promise<PKCEPair> {
  const codeVerifier = generateCodeVerifier(verifierLength);
  const codeChallenge = await computeCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}

// ── Authorization URL ────────────────────────────────────────────────────

/**
 * Build the authorization URL for the code flow with PKCE.
 */
export function buildAuthorizationUrl(
  config: OAuth2Config,
  state: string,
  codeChallenge: string,
  scopes?: string[],
): string {
  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  const scopeList = scopes ?? (config.scopes ? Object.keys(config.scopes) : []);
  if (scopeList.length > 0) {
    url.searchParams.set("scope", scopeList.join(" "));
  }

  return url.toString();
}

// ── Token Exchange ───────────────────────────────────────────────────────

/** Default HTTP client using globalThis.fetch. */
const defaultHttpClient: OAuth2HttpClient = {
  async post(url, body, headers) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
      body: body.toString(),
    });
    return { status: resp.status, json: () => resp.json() as Promise<unknown> };
  },
};

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCode(
  config: OAuth2Config,
  code: string,
  codeVerifier: string,
  httpClient: OAuth2HttpClient = defaultHttpClient,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: codeVerifier,
  });

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  const resp = await httpClient.post(config.tokenEndpoint, body);

  if (resp.status !== 200) {
    const err = (await resp.json()) as OAuth2Error;
    throw new OAuth2TokenError(
      err.error_description ?? err.error ?? "Token exchange failed",
      err.error ?? "server_error",
      resp.status,
    );
  }

  return (await resp.json()) as TokenResponse;
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(
  config: OAuth2Config,
  refreshToken: string,
  httpClient: OAuth2HttpClient = defaultHttpClient,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  });

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  const resp = await httpClient.post(config.tokenEndpoint, body);

  if (resp.status !== 200) {
    const err = (await resp.json()) as OAuth2Error;
    throw new OAuth2TokenError(
      err.error_description ?? err.error ?? "Token refresh failed",
      err.error ?? "server_error",
      resp.status,
    );
  }

  return (await resp.json()) as TokenResponse;
}

// ── Token Validation ─────────────────────────────────────────────────────

/**
 * Decode and validate an access token (JWT).
 * This performs structural validation only (expiry, issuer, audience, scopes).
 * Signature verification should be done at the framework layer with a proper JWKS.
 */
export function validateAccessToken(
  token: string,
  config: OAuth2Config,
  requiredScopes?: string[],
  clockSkewSeconds = 30,
): TokenValidationResult {
  // Decode JWT payload
  const decoded = decodeJwtPayload(token);
  if (!decoded) {
    return { valid: false, error: "malformed_token" };
  }

  const now = Math.floor(Date.now() / 1000);

  // Check expiration
  const exp = Number(decoded.exp ?? 0);
  if (exp && exp + clockSkewSeconds < now) {
    return { valid: false, error: "token_expired" };
  }

  // Check issuer
  if (config.issuer && decoded.iss !== config.issuer) {
    return { valid: false, error: "invalid_issuer" };
  }

  // Check audience
  if (config.audience) {
    const aud = decoded.aud;
    const audList = Array.isArray(aud) ? aud : aud ? [aud] : [];
    if (!audList.includes(config.audience)) {
      return { valid: false, error: "invalid_audience" };
    }
  }

  // Extract scopes
  const scopes = extractScopes(decoded);

  // Check required scopes
  if (requiredScopes && requiredScopes.length > 0) {
    const missing = requiredScopes.filter((s) => !scopes.includes(s));
    if (missing.length > 0) {
      return { valid: false, error: `missing_scopes: ${missing.join(", ")}` };
    }
  }

  const decodedToken: DecodedAccessToken = {
    sub: String(decoded.sub ?? ""),
    iss: decoded.iss != null ? String(decoded.iss) : undefined,
    aud: decoded.aud as string | string[] | undefined,
    exp,
    iat: decoded.iat != null ? Number(decoded.iat) : undefined,
    scopes,
    client_id: decoded.client_id != null ? String(decoded.client_id) : undefined,
    claims: decoded,
  };

  return { valid: true, token: decodedToken };
}

// ── Bearer Token Extraction ──────────────────────────────────────────────

/**
 * Extract a Bearer token from an Authorization header value.
 * Returns null if the header is missing or not a Bearer token.
 */
export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) return null;
  const parts = authorizationHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  return parts[1];
}

// ── OAuth2 Discovery ─────────────────────────────────────────────────────

/**
 * Build an OAuth2 Authorization Server Metadata document (RFC 8414).
 */
export function buildOAuth2Metadata(config: OAuth2Config): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    authorization_endpoint: config.authorizationEndpoint,
    token_endpoint: config.tokenEndpoint,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: config.clientSecret
      ? ["client_secret_post"]
      : ["none"],
  };

  if (config.issuer) metadata.issuer = config.issuer;
  if (config.scopes) metadata.scopes_supported = Object.keys(config.scopes);

  return metadata;
}

// ── Error Class ──────────────────────────────────────────────────────────

export class OAuth2TokenError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "OAuth2TokenError";
  }
}

// ── Internal Helpers ─────────────────────────────────────────────────────

function base64urlEncode(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const base64 = typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): string {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return typeof atob === "function"
    ? atob(base64)
    : Buffer.from(base64, "base64").toString("utf-8");
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(base64urlDecode(parts[1]));
  } catch {
    return null;
  }
}

function extractScopes(payload: Record<string, unknown>): string[] {
  if (typeof payload.scope === "string") {
    return payload.scope.split(" ").filter(Boolean);
  }
  if (Array.isArray(payload.scopes)) return payload.scopes.map(String);
  if (Array.isArray(payload.scp)) return payload.scp.map(String);
  return [];
}
