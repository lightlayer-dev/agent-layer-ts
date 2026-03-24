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

function mockReq(headers: Record<string, string> = {}): any {
  return { headers, oauth2Token: undefined };
}

function mockRes(): any {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    status(code: number) { res.statusCode = code; return res; },
    json(data: unknown) { res.body = data; return res; },
    setHeader(key: string, val: string) { res.headers[key.toLowerCase()] = val; return res; },
  };
  return res;
}

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

describe("oauth2Auth Express", () => {
  it("requireToken passes with valid token and attaches decoded token", async () => {
    const handlers = oauth2Auth(config);
    const middleware = handlers.requireToken(["read:data"]);
    const req = mockReq({ authorization: `Bearer ${validToken()}` });
    const res = mockRes();
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      middleware(req, res, (...args: unknown[]) => { next(...args); resolve(); });
    });

    expect(next).toHaveBeenCalled();
    expect(req.oauth2Token).toBeDefined();
    expect(req.oauth2Token.sub).toBe("agent-123");
    expect(req.oauth2Token.scopes).toContain("read:data");
  });

  it("requireToken returns 401 without Authorization header", async () => {
    const handlers = oauth2Auth(config);
    const middleware = handlers.requireToken();
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      middleware(req, res, next);
      // Give the promise time to resolve
      setTimeout(resolve, 10);
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toContain("Bearer");
  });

  it("requireToken returns 403 for insufficient scopes", async () => {
    const handlers = oauth2Auth(config);
    const middleware = handlers.requireToken(["admin"]);
    const req = mockReq({ authorization: `Bearer ${validToken("read:data")}` });
    const res = mockRes();
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      middleware(req, res, next);
      setTimeout(resolve, 10);
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("metadata returns RFC 8414 document", () => {
    const handlers = oauth2Auth(config);
    const res = mockRes();

    handlers.metadata({} as any, res);

    expect(res.body.authorization_endpoint).toBe("https://auth.example.com/authorize");
    expect(res.body.token_endpoint).toBe("https://auth.example.com/token");
    expect(res.body.code_challenge_methods_supported).toEqual(["S256"]);
  });
});
