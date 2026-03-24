import { describe, it, expect } from "vitest";
import {
  generateCodeVerifier,
  computeCodeChallenge,
  generatePKCE,
  buildAuthorizationUrl,
  extractBearerToken,
  validateAccessToken,
  buildOAuth2Metadata,
  OAuth2TokenError,
  exchangeCode,
  refreshAccessToken,
} from "./oauth2.js";
import type { OAuth2Config, OAuth2HttpClient } from "./oauth2.js";
import { makeJwt } from "./test-utils.js";

const baseConfig: OAuth2Config = {
  clientId: "test-client",
  authorizationEndpoint: "https://auth.example.com/authorize",
  tokenEndpoint: "https://auth.example.com/token",
  redirectUri: "https://app.example.com/callback",
  scopes: { "read:data": "Read data", "write:data": "Write data" },
  issuer: "https://auth.example.com",
  audience: "https://api.example.com",
};

// ── PKCE ────────────────────────────────────────────────────────────────

describe("PKCE", () => {
  it("generates a code verifier of correct length", () => {
    const v = generateCodeVerifier(64);
    expect(v).toHaveLength(64);
    // All chars should be unreserved URI chars
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("generates different verifiers each time", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it("computes a base64url-encoded SHA-256 challenge", async () => {
    const challenge = await computeCodeChallenge("test-verifier");
    // Should be base64url (no +, /, or = padding)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.length).toBeGreaterThan(0);
  });

  it("same verifier produces same challenge", async () => {
    const a = await computeCodeChallenge("my-verifier");
    const b = await computeCodeChallenge("my-verifier");
    expect(a).toBe(b);
  });

  it("generatePKCE returns a valid pair", async () => {
    const pair = await generatePKCE();
    expect(pair.codeVerifier).toHaveLength(64);
    expect(pair.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    // Verify they match
    const expected = await computeCodeChallenge(pair.codeVerifier);
    expect(pair.codeChallenge).toBe(expected);
  });
});

// ── Authorization URL ───────────────────────────────────────────────────

describe("buildAuthorizationUrl", () => {
  it("builds a proper authorization URL with PKCE", () => {
    const url = buildAuthorizationUrl(baseConfig, "random-state", "challenge123", ["read:data"]);
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe("https://auth.example.com/authorize");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("test-client");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://app.example.com/callback");
    expect(parsed.searchParams.get("state")).toBe("random-state");
    expect(parsed.searchParams.get("code_challenge")).toBe("challenge123");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("scope")).toBe("read:data");
  });

  it("uses all config scopes when none specified", () => {
    const url = buildAuthorizationUrl(baseConfig, "state", "challenge");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("scope")).toBe("read:data write:data");
  });

  it("omits scope param when no scopes configured", () => {
    const noScopeConfig = { ...baseConfig, scopes: undefined };
    const url = buildAuthorizationUrl(noScopeConfig, "state", "challenge", []);
    const parsed = new URL(url);
    expect(parsed.searchParams.has("scope")).toBe(false);
  });
});

// ── Bearer Token Extraction ─────────────────────────────────────────────

describe("extractBearerToken", () => {
  it("extracts token from valid Bearer header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("is case-insensitive for Bearer prefix", () => {
    expect(extractBearerToken("bearer abc123")).toBe("abc123");
  });

  it("returns null for missing header", () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("returns null for non-Bearer scheme", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("returns null for malformed header", () => {
    expect(extractBearerToken("Bearer")).toBeNull();
    expect(extractBearerToken("")).toBeNull();
  });
});

// ── Token Validation ────────────────────────────────────────────────────

describe("validateAccessToken", () => {
  const now = Math.floor(Date.now() / 1000);

  it("validates a good token", () => {
    const token = makeJwt({
      sub: "agent-123",
      iss: "https://auth.example.com",
      aud: "https://api.example.com",
      exp: now + 600,
      iat: now,
      scope: "read:data write:data",
    });

    const result = validateAccessToken(token, baseConfig);
    expect(result.valid).toBe(true);
    expect(result.token?.sub).toBe("agent-123");
    expect(result.token?.scopes).toEqual(["read:data", "write:data"]);
  });

  it("rejects expired token", () => {
    const token = makeJwt({
      sub: "agent-123",
      iss: "https://auth.example.com",
      aud: "https://api.example.com",
      exp: now - 100,
      iat: now - 700,
    });

    const result = validateAccessToken(token, baseConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("token_expired");
  });

  it("rejects wrong issuer", () => {
    const token = makeJwt({
      sub: "agent-123",
      iss: "https://evil.example.com",
      aud: "https://api.example.com",
      exp: now + 600,
    });

    const result = validateAccessToken(token, baseConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_issuer");
  });

  it("rejects wrong audience", () => {
    const token = makeJwt({
      sub: "agent-123",
      iss: "https://auth.example.com",
      aud: "https://other.example.com",
      exp: now + 600,
    });

    const result = validateAccessToken(token, baseConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_audience");
  });

  it("rejects missing required scopes", () => {
    const token = makeJwt({
      sub: "agent-123",
      iss: "https://auth.example.com",
      aud: "https://api.example.com",
      exp: now + 600,
      scope: "read:data",
    });

    const result = validateAccessToken(token, baseConfig, ["read:data", "admin"]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("missing_scopes");
    expect(result.error).toContain("admin");
  });

  it("passes when all required scopes are present", () => {
    const token = makeJwt({
      sub: "agent-123",
      iss: "https://auth.example.com",
      aud: "https://api.example.com",
      exp: now + 600,
      scope: "read:data write:data",
    });

    const result = validateAccessToken(token, baseConfig, ["read:data"]);
    expect(result.valid).toBe(true);
  });

  it("rejects malformed token", () => {
    const result = validateAccessToken("not-a-jwt", baseConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("malformed_token");
  });

  it("handles array audience in token", () => {
    const token = makeJwt({
      sub: "agent-123",
      iss: "https://auth.example.com",
      aud: ["https://api.example.com", "https://other.example.com"],
      exp: now + 600,
    });

    const result = validateAccessToken(token, baseConfig);
    expect(result.valid).toBe(true);
  });

  it("supports scopes as array claim", () => {
    const token = makeJwt({
      sub: "agent-123",
      iss: "https://auth.example.com",
      aud: "https://api.example.com",
      exp: now + 600,
      scopes: ["read:data", "write:data"],
    });

    const result = validateAccessToken(token, baseConfig);
    expect(result.valid).toBe(true);
    expect(result.token?.scopes).toEqual(["read:data", "write:data"]);
  });
});

// ── Token Exchange (mock HTTP) ──────────────────────────────────────────

describe("exchangeCode", () => {
  const mockSuccessClient: OAuth2HttpClient = {
    async post() {
      return {
        status: 200,
        json: async () => ({
          access_token: "new-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "new-refresh-token",
          scope: "read:data",
        }),
      };
    },
  };

  const mockErrorClient: OAuth2HttpClient = {
    async post() {
      return {
        status: 400,
        json: async () => ({
          error: "invalid_grant",
          error_description: "The authorization code has expired",
        }),
      };
    },
  };

  it("exchanges code for tokens successfully", async () => {
    const result = await exchangeCode(baseConfig, "auth-code", "verifier", mockSuccessClient);
    expect(result.access_token).toBe("new-access-token");
    expect(result.token_type).toBe("Bearer");
    expect(result.expires_in).toBe(3600);
    expect(result.refresh_token).toBe("new-refresh-token");
  });

  it("throws OAuth2TokenError on failure", async () => {
    await expect(
      exchangeCode(baseConfig, "bad-code", "verifier", mockErrorClient),
    ).rejects.toThrow(OAuth2TokenError);

    try {
      await exchangeCode(baseConfig, "bad-code", "verifier", mockErrorClient);
    } catch (e) {
      const err = e as OAuth2TokenError;
      expect(err.errorCode).toBe("invalid_grant");
      expect(err.statusCode).toBe(400);
    }
  });
});

describe("refreshAccessToken", () => {
  const mockClient: OAuth2HttpClient = {
    async post() {
      return {
        status: 200,
        json: async () => ({
          access_token: "refreshed-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      };
    },
  };

  it("refreshes token successfully", async () => {
    const result = await refreshAccessToken(baseConfig, "old-refresh-token", mockClient);
    expect(result.access_token).toBe("refreshed-token");
  });
});

// ── OAuth2 Metadata ─────────────────────────────────────────────────────

describe("buildOAuth2Metadata", () => {
  it("builds RFC 8414 metadata document", () => {
    const meta = buildOAuth2Metadata(baseConfig);
    expect(meta.authorization_endpoint).toBe("https://auth.example.com/authorize");
    expect(meta.token_endpoint).toBe("https://auth.example.com/token");
    expect(meta.response_types_supported).toEqual(["code"]);
    expect(meta.grant_types_supported).toEqual(["authorization_code", "refresh_token"]);
    expect(meta.code_challenge_methods_supported).toEqual(["S256"]);
    expect(meta.scopes_supported).toEqual(["read:data", "write:data"]);
    expect(meta.issuer).toBe("https://auth.example.com");
  });

  it("sets auth method to none for public clients", () => {
    const publicConfig = { ...baseConfig, clientSecret: undefined };
    const meta = buildOAuth2Metadata(publicConfig);
    expect(meta.token_endpoint_auth_methods_supported).toEqual(["none"]);
  });

  it("sets auth method to client_secret_post for confidential clients", () => {
    const confConfig = { ...baseConfig, clientSecret: "secret" };
    const meta = buildOAuth2Metadata(confConfig);
    expect(meta.token_endpoint_auth_methods_supported).toEqual(["client_secret_post"]);
  });
});
