import { describe, it, expect } from "vitest";
import Fastify from "fastify";
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

describe("oauth2Auth Fastify", () => {
  it("requireToken passes with valid token", async () => {
    const app = Fastify();
    const handlers = oauth2Auth(config);

    app.register(handlers.metadataPlugin);
    app.addHook("preHandler", handlers.requireToken(["read:data"]));
    app.get("/api/data", async (req) => {
      return { sub: req.oauth2Token?.sub, scopes: req.oauth2Token?.scopes };
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/data",
      headers: { authorization: `Bearer ${validToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sub).toBe("agent-123");
    expect(body.scopes).toContain("read:data");
  });

  it("requireToken returns 401 without Authorization header", async () => {
    const app = Fastify();
    const handlers = oauth2Auth(config);

    app.addHook("preHandler", handlers.requireToken());
    app.get("/api/data", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/api/data",
    });

    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toContain("Bearer");
  });

  it("requireToken returns 403 for insufficient scopes", async () => {
    const app = Fastify();
    const handlers = oauth2Auth(config);

    app.addHook("preHandler", handlers.requireToken(["admin"]));
    app.get("/api/data", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/api/data",
      headers: { authorization: `Bearer ${validToken("read:data")}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it("metadata plugin serves RFC 8414 document", async () => {
    const app = Fastify();
    const handlers = oauth2Auth(config);
    app.register(handlers.metadataPlugin);

    const res = await app.inject({
      method: "GET",
      url: "/.well-known/oauth-authorization-server",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.authorization_endpoint).toBe("https://auth.example.com/authorize");
    expect(body.token_endpoint).toBe("https://auth.example.com/token");
    expect(body.code_challenge_methods_supported).toEqual(["S256"]);
  });
});
