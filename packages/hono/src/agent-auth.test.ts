import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { agentAuth } from "./agent-auth.js";

const config = {
  issuer: "https://auth.example.com",
  authorizationUrl: "https://auth.example.com/authorize",
  tokenUrl: "https://auth.example.com/token",
  scopes: { read: "Read access", write: "Write access" },
};

describe("agentAuth", () => {
  it("oauthDiscovery returns the discovery document", async () => {
    const app = new Hono();
    const handlers = agentAuth(config);
    app.get("/.well-known/oauth-authorization-server", (c) => handlers.oauthDiscovery(c));

    const res = await app.request("/.well-known/oauth-authorization-server");
    const body = await res.json();

    expect(body).toEqual({
      issuer: "https://auth.example.com",
      authorization_endpoint: "https://auth.example.com/authorize",
      token_endpoint: "https://auth.example.com/token",
      scopes_supported: ["read", "write"],
    });
  });

  it("requireAuth returns 401 when no Authorization header", async () => {
    const app = new Hono();
    const handlers = agentAuth(config);
    app.use("*", handlers.requireAuth());
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");

    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe("authentication_required");
  });

  it("requireAuth sets WWW-Authenticate header", async () => {
    const app = new Hono();
    const handlers = agentAuth(config);
    app.use("*", handlers.requireAuth());
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");

    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    expect(res.headers.get("www-authenticate")).toContain("realm=");
  });

  it("requireAuth calls next when Authorization header is present", async () => {
    const app = new Hono();
    const handlers = agentAuth(config);
    app.use("*", handlers.requireAuth());
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { authorization: "Bearer token123" },
    });

    expect(res.status).toBe(200);
  });

  it("uses custom realm", async () => {
    const app = new Hono();
    const handlers = agentAuth({ ...config, realm: "my-api" });
    app.use("*", handlers.requireAuth());
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");

    expect(res.headers.get("www-authenticate")).toContain('realm="my-api"');
  });
});
