import { describe, it, expect, vi } from "vitest";
import { oauth2Auth } from "./oauth2.js";
import type { OAuth2Config } from "@agent-layer/core";
import { makeJwt } from "@agent-layer/core/testing";

const now = Math.floor(Date.now() / 1000);

const config: OAuth2Config = {
  clientId: "test-client",
  authorizationEndpoint: "https://auth.example.com/authorize",
  tokenEndpoint: "https://auth.example.com/token",
  redirectUri: "https://app.example.com/callback",
  issuer: "https://auth.example.com",
  audience: "https://api.example.com",
  scopes: { "read:data": "Read", "write:data": "Write" },
};

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

function mockCtx(headers: Record<string, string> = {}): any {
  return {
    headers,
    state: {} as Record<string, unknown>,
    status: 200,
    body: null as unknown,
    set(key: string, val: string) {
      this.headers[key.toLowerCase()] = val;
    },
  };
}

describe("oauth2Auth (Koa)", () => {
  it("requireToken passes with valid token and attaches decoded token", async () => {
    const handlers = oauth2Auth(config);
    const middleware = handlers.requireToken(["read:data"]);
    const ctx = mockCtx({ authorization: `Bearer ${validToken()}` });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.state.oauth2Token).toBeDefined();
    expect(ctx.state.oauth2Token.sub).toBe("agent-123");
    expect(ctx.state.oauth2Token.scopes).toContain("read:data");
  });

  it("requireToken returns 401 without Authorization header", async () => {
    const handlers = oauth2Auth(config);
    const middleware = handlers.requireToken();
    const ctx = mockCtx();
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.status).toBe(401);
    expect(ctx.headers["www-authenticate"]).toContain("Bearer");
  });

  it("requireToken returns 403 for insufficient scopes", async () => {
    const handlers = oauth2Auth(config);
    const middleware = handlers.requireToken(["admin"]);
    const ctx = mockCtx({ authorization: `Bearer ${validToken("read:data")}` });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.status).toBe(403);
  });

  it("metadata returns RFC 8414 document", () => {
    const handlers = oauth2Auth(config);
    const ctx = mockCtx();

    handlers.metadata(ctx);

    expect(ctx.body.authorization_endpoint).toBe("https://auth.example.com/authorize");
    expect(ctx.body.token_endpoint).toBe("https://auth.example.com/token");
    expect(ctx.body.code_challenge_methods_supported).toEqual(["S256"]);
  });
});
