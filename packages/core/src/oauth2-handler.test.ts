import { describe, it, expect } from "vitest";
import { handleOAuth2 } from "./oauth2-handler.js";
import type { OAuth2MiddlewareConfig } from "./oauth2-handler.js";
import type { OAuth2Config } from "./oauth2.js";
import { makeJwt } from "./test-utils.js";

const oauth2Config: OAuth2Config = {
  clientId: "test-client",
  authorizationEndpoint: "https://auth.example.com/authorize",
  tokenEndpoint: "https://auth.example.com/token",
  redirectUri: "https://app.example.com/callback",
  issuer: "https://auth.example.com",
  audience: "https://api.example.com",
  scopes: { "read:data": "Read data", "write:data": "Write data" },
};

const middlewareConfig: OAuth2MiddlewareConfig = {
  oauth2: oauth2Config,
  requiredScopes: ["read:data"],
};

const now = Math.floor(Date.now() / 1000);

function validToken(scopes = "read:data write:data"): string {
  return makeJwt({
    sub: "agent-123",
    iss: "https://auth.example.com",
    aud: "https://api.example.com",
    exp: now + 600,
    iat: now,
    scope: scopes,
  });
}

describe("handleOAuth2", () => {
  it("passes with a valid token and sufficient scopes", async () => {
    const result = await handleOAuth2(`Bearer ${validToken()}`, middlewareConfig);
    expect(result.pass).toBe(true);
    if (result.pass) {
      expect(result.token.sub).toBe("agent-123");
      expect(result.token.scopes).toContain("read:data");
    }
  });

  it("returns 401 when no Authorization header", async () => {
    const result = await handleOAuth2(undefined, middlewareConfig);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.status).toBe(401);
      expect(result.wwwAuthenticate).toContain("Bearer");
      expect(result.envelope.code).toBe("authentication_required");
    }
  });

  it("returns 401 for expired token", async () => {
    const expired = makeJwt({
      sub: "agent-123",
      iss: "https://auth.example.com",
      aud: "https://api.example.com",
      exp: now - 100,
    });
    const result = await handleOAuth2(`Bearer ${expired}`, middlewareConfig);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.status).toBe(401);
      expect(result.envelope.code).toBe("invalid_token");
    }
  });

  it("returns 403 for insufficient scopes", async () => {
    const config: OAuth2MiddlewareConfig = {
      oauth2: oauth2Config,
      requiredScopes: ["admin"],
    };
    const result = await handleOAuth2(`Bearer ${validToken("read:data")}`, config);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.status).toBe(403);
      expect(result.envelope.code).toBe("insufficient_scope");
      expect(result.wwwAuthenticate).toContain("insufficient_scope");
    }
  });

  it("returns 401 for malformed token", async () => {
    const result = await handleOAuth2("Bearer not-a-jwt", middlewareConfig);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.status).toBe(401);
    }
  });

  it("returns 401 for non-Bearer scheme", async () => {
    const result = await handleOAuth2("Basic abc123", middlewareConfig);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.status).toBe(401);
    }
  });

  it("uses custom validator when provided", async () => {
    const config: OAuth2MiddlewareConfig = {
      oauth2: oauth2Config,
      customValidator: async () => ({
        valid: true,
        token: {
          sub: "custom-agent",
          iss: "https://auth.example.com",
          exp: now + 600,
          scopes: ["read:data"],
          claims: {},
        },
      }),
    };
    const result = await handleOAuth2("Bearer any-token", config);
    expect(result.pass).toBe(true);
    if (result.pass) {
      expect(result.token.sub).toBe("custom-agent");
    }
  });

  it("includes docs_url pointing to authorization endpoint on 401", async () => {
    const result = await handleOAuth2(undefined, middlewareConfig);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.envelope.docs_url).toBe("https://auth.example.com/authorize");
    }
  });
});
