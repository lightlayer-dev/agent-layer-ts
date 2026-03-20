import { describe, it, expect } from "vitest";
import Koa from "koa";
import Router from "@koa/router";
import request from "supertest";
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
  scope: "read:data",
};

const baseConfig: AgentIdentityConfig = {
  trustedIssuers: ["https://auth.example.com"],
  audience: ["https://api.example.com"],
};

function createApp(config: AgentIdentityConfig, optional = false) {
  const app = new Koa();
  const router = new Router();
  const identity = agentIdentity(config);

  if (optional) {
    app.use(identity.optionalIdentity());
  } else {
    app.use(identity.requireIdentity());
  }

  router.get("/test", (ctx) => {
    ctx.body = {
      agentId: ctx.state.agentIdentity?.agentId ?? null,
      scopes: ctx.state.agentIdentity?.scopes ?? null,
    };
  });

  app.use(router.routes());
  return app.callback();
}

describe("Koa agentIdentity middleware", () => {
  it("accepts valid agent token", async () => {
    const app = createApp(baseConfig);
    const res = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${makeJwt(validPayload)}`);

    expect(res.status).toBe(200);
    expect(res.body.agentId).toBe("spiffe://example.com/agent/test-bot");
  });

  it("rejects missing token", async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get("/test");
    expect(res.status).toBe(401);
  });

  it("rejects untrusted issuer", async () => {
    const app = createApp(baseConfig);
    const token = makeJwt({ ...validPayload, iss: "https://evil.com" });
    const res = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("enforces authorization policies", async () => {
    const config: AgentIdentityConfig = {
      ...baseConfig,
      policies: [{ name: "admin", requiredScopes: ["admin"] }],
    };
    const app = createApp(config);
    const res = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${makeJwt(validPayload)}`);
    expect(res.status).toBe(403);
  });
});

describe("Koa optionalIdentity", () => {
  it("attaches identity when present", async () => {
    const app = createApp(baseConfig, true);
    const res = await request(app)
      .get("/test")
      .set("Authorization", `Bearer ${makeJwt(validPayload)}`);
    expect(res.status).toBe(200);
    expect(res.body.agentId).toBe("spiffe://example.com/agent/test-bot");
  });

  it("passes through without token", async () => {
    const app = createApp(baseConfig, true);
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.body.agentId).toBeNull();
  });
});
