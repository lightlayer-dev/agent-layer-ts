import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { agentIdentity } from "./agent-identity.js";
import type { AgentIdentityConfig } from "@agent-layer/core";

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.nosig`;
}

const now = Math.floor(Date.now() / 1000);

const validPayload = {
  iss: "https://auth.example.com",
  sub: "spiffe://example.com/agent/test-bot",
  aud: "https://api.example.com",
  exp: now + 600,
  iat: now,
  scope: "read:data write:data",
};

const baseConfig: AgentIdentityConfig = {
  trustedIssuers: ["https://auth.example.com"],
  audience: ["https://api.example.com"],
};

function createApp(config: AgentIdentityConfig, optional = false) {
  const app = new Hono();
  const identity = agentIdentity(config);

  if (optional) {
    app.use("*", identity.optionalIdentity());
  } else {
    app.use("*", identity.requireIdentity());
  }

  app.get("/test", (c) => {
    const agentId = c.get("agentIdentity") as any;
    return c.json({
      agentId: agentId?.agentId ?? null,
      delegated: agentId?.delegated ?? null,
      scopes: agentId?.scopes ?? null,
    });
  });

  return app;
}

describe("agentIdentity middleware", () => {
  it("accepts valid agent token", async () => {
    const app = createApp(baseConfig);
    const res = await app.request("/test", {
      headers: { authorization: `Bearer ${makeJwt(validPayload)}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.agentId).toBe("spiffe://example.com/agent/test-bot");
    expect(body.scopes).toEqual(["read:data", "write:data"]);
  });

  it("rejects missing token with 401", async () => {
    const app = createApp(baseConfig);
    const res = await app.request("/test");

    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe("agent_identity_required");
  });

  it("rejects untrusted issuer with 403", async () => {
    const app = createApp(baseConfig);
    const token = makeJwt({ ...validPayload, iss: "https://evil.com" });
    const res = await app.request("/test", {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error.code).toBe("untrusted_issuer");
  });

  it("rejects expired token with 401", async () => {
    const app = createApp({ ...baseConfig, clockSkewSeconds: 0 });
    const token = makeJwt({ ...validPayload, exp: now - 600 });
    const res = await app.request("/test", {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe("expired_token");
  });

  it("rejects token with excessive lifetime", async () => {
    const app = createApp({ ...baseConfig, maxLifetimeSeconds: 300 });
    const token = makeJwt({ ...validPayload, iat: now, exp: now + 600 });
    const res = await app.request("/test", {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error.code).toBe("token_too_long_lived");
  });

  it("enforces authorization policies", async () => {
    const config: AgentIdentityConfig = {
      ...baseConfig,
      policies: [
        {
          name: "read-only",
          methods: ["GET"],
          requiredScopes: ["read:data"],
        },
      ],
    };
    const app = createApp(config);
    const res = await app.request("/test", {
      headers: { authorization: `Bearer ${makeJwt(validPayload)}` },
    });

    expect(res.status).toBe(200);
  });

  it("denies when policy scopes are missing", async () => {
    const config: AgentIdentityConfig = {
      ...baseConfig,
      policies: [
        {
          name: "admin-only",
          requiredScopes: ["admin"],
        },
      ],
    };
    const app = createApp(config);
    const res = await app.request("/test", {
      headers: { authorization: `Bearer ${makeJwt(validPayload)}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error.code).toBe("agent_unauthorized");
  });

  it("supports custom verifyToken", async () => {
    const config: AgentIdentityConfig = {
      ...baseConfig,
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
    const res = await app.request("/test", {
      headers: { authorization: "Bearer any-token" },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.agentId).toBe("custom-agent");
  });

  it("rejects when custom verifyToken returns null", async () => {
    const config: AgentIdentityConfig = {
      ...baseConfig,
      verifyToken: async () => null,
    };
    const app = createApp(config);
    const res = await app.request("/test", {
      headers: { authorization: "Bearer bad-token" },
    });

    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe("verification_failed");
  });
});

describe("optionalIdentity middleware", () => {
  it("attaches identity when token is present", async () => {
    const app = createApp(baseConfig, true);
    const res = await app.request("/test", {
      headers: { authorization: `Bearer ${makeJwt(validPayload)}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.agentId).toBe("spiffe://example.com/agent/test-bot");
  });

  it("passes through when no token", async () => {
    const app = createApp(baseConfig, true);
    const res = await app.request("/test");

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.agentId).toBeNull();
  });

  it("passes through with invalid token (does not reject)", async () => {
    const app = createApp(baseConfig, true);
    const res = await app.request("/test", {
      headers: { authorization: "Bearer not-a-jwt" },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.agentId).toBeNull();
  });
});
