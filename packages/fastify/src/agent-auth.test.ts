import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { agentAuth } from "./agent-auth.js";
import type { AgentAuthConfig } from "@agent-layer/core";

const baseConfig: AgentAuthConfig = {
  issuer: "https://auth.example.com",
  authorizationUrl: "https://auth.example.com/authorize",
  tokenUrl: "https://auth.example.com/token",
  scopes: { "read:data": "Read data", "write:data": "Write data" },
  realm: "test-api",
};

describe("agentAuth (Fastify)", () => {
  it("OAuth discovery endpoint returns expected document", async () => {
    const app = Fastify();
    const auth = agentAuth(baseConfig);
    await app.register(auth.discoveryPlugin);

    const res = await app.inject({
      method: "GET",
      url: "/.well-known/oauth-authorization-server",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.issuer).toBe("https://auth.example.com");
    expect(body.authorization_endpoint).toBe("https://auth.example.com/authorize");
    expect(body.token_endpoint).toBe("https://auth.example.com/token");
    expect(body.scopes_supported).toEqual(["read:data", "write:data"]);
  });

  it("requireAuth hook passes when Authorization header is present", async () => {
    const app = Fastify();
    const auth = agentAuth(baseConfig);
    await app.register(auth.discoveryPlugin);
    app.addHook("onRequest", auth.requireAuth());
    app.get("/test", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer some-token" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("requireAuth hook returns 401 with WWW-Authenticate when no auth header", async () => {
    const app = Fastify();
    const auth = agentAuth(baseConfig);
    await app.register(auth.discoveryPlugin);
    app.addHook("onRequest", auth.requireAuth());
    app.get("/test", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/test",
    });

    expect(res.statusCode).toBe(401);
    expect(res.headers["www-authenticate"]).toContain("Bearer");
    expect(res.headers["www-authenticate"]).toContain("test-api");
    const body = res.json();
    expect(body.error.code).toBe("authentication_required");
  });
});
