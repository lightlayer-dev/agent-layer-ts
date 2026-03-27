import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
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

describe("oauth2Auth (Hono)", () => {
  it("requireToken passes with valid token", async () => {
    const handlers = oauth2Auth(config);
    const app = new Hono();
    app.use("*", handlers.requireToken(["read:data"]));
    app.get("/data", (c) => c.json({ ok: true }));

    const res = await app.request("/data", {
      headers: { authorization: `Bearer ${validToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("requireToken returns 401 without Authorization header", async () => {
    const handlers = oauth2Auth(config);
    const app = new Hono();
    app.use("*", handlers.requireToken());
    app.get("/data", (c) => c.json({ ok: true }));

    const res = await app.request("/data");

    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("requireToken returns 403 for insufficient scopes", async () => {
    const handlers = oauth2Auth(config);
    const app = new Hono();
    app.use("*", handlers.requireToken(["admin"]));
    app.get("/data", (c) => c.json({ ok: true }));

    const res = await app.request("/data", {
      headers: { authorization: `Bearer ${validToken("read:data")}` },
    });

    expect(res.status).toBe(403);
  });

  it("metadata returns RFC 8414 document", async () => {
    const handlers = oauth2Auth(config);
    const app = new Hono();
    app.get("/.well-known/oauth-authorization-server", (c) => handlers.metadata(c));

    const res = await app.request("/.well-known/oauth-authorization-server");
    const body = await res.json() as any;

    expect(body.authorization_endpoint).toBe("https://auth.example.com/authorize");
    expect(body.token_endpoint).toBe("https://auth.example.com/token");
    expect(body.code_challenge_methods_supported).toEqual(["S256"]);
  });
});
