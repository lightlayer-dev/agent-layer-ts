import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { agentIdentity } from "./agent-identity.js";
import { makeJwt, validJwtPayload, baseIdentityConfig } from "@agent-layer/core/testing";
import type { AgentIdentityConfig } from "@agent-layer/core";

const now = Math.floor(Date.now() / 1000);

function createApp(config: AgentIdentityConfig, optional = false) {
  const app = Fastify();
  const identity = agentIdentity(config);

  app.register(identity.plugin);

  if (optional) {
    app.addHook("onRequest", identity.optionalIdentity());
  } else {
    app.addHook("onRequest", identity.requireIdentity());
  }

  app.get("/test", async (request) => ({
    agentId: request.agentIdentity?.agentId ?? null,
    delegated: request.agentIdentity?.delegated ?? null,
    scopes: request.agentIdentity?.scopes ?? null,
  }));

  return app;
}

describe("agentIdentity (Fastify)", () => {
  it("accepts valid agent token", async () => {
    const app = createApp(baseIdentityConfig);
    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: `Bearer ${makeJwt(validJwtPayload)}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.agentId).toBe("spiffe://example.com/agent/test-bot");
    expect(body.scopes).toEqual(["read:data", "write:data"]);
  });

  it("rejects missing token with 401", async () => {
    const app = createApp(baseIdentityConfig);
    const res = await app.inject({
      method: "GET",
      url: "/test",
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe("agent_identity_required");
  });

  it("rejects untrusted issuer with 403", async () => {
    const app = createApp(baseIdentityConfig);
    const token = makeJwt({ ...validJwtPayload, iss: "https://evil.com" });
    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error.code).toBe("untrusted_issuer");
  });

  it("rejects expired token with 401", async () => {
    const app = createApp({ ...baseIdentityConfig, clockSkewSeconds: 0 });
    const token = makeJwt({ ...validJwtPayload, exp: now - 600 });
    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe("expired_token");
  });

  it("supports custom verifyToken", async () => {
    const config: AgentIdentityConfig = {
      ...baseIdentityConfig,
      verifyToken: async () => ({
        agentId: "custom-agent",
        issuer: "https://auth.example.com",
        subject: "custom-agent",
        audience: ["https://api.example.com"],
        expiresAt: now + 600,
        issuedAt: now,
        scopes: ["all"],
        delegated: false,
        customClaims: {},
      }),
    };
    const app = createApp(config);
    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer any-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.agentId).toBe("custom-agent");
  });
});

describe("optionalIdentity (Fastify)", () => {
  it("attaches claims when token is present", async () => {
    const app = createApp(baseIdentityConfig, true);
    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: `Bearer ${makeJwt(validJwtPayload)}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.agentId).toBe("spiffe://example.com/agent/test-bot");
  });

  it("passes through when no token", async () => {
    const app = createApp(baseIdentityConfig, true);
    const res = await app.inject({
      method: "GET",
      url: "/test",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.agentId).toBeNull();
  });
});
