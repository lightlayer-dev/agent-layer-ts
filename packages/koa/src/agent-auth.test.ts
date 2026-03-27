import { describe, it, expect, vi } from "vitest";
import { agentAuth } from "./agent-auth.js";

function mockCtx(overrides: Record<string, unknown> = {}): any {
  const _headers: Record<string, string> = {};
  return {
    headers: {},
    status: 200,
    body: null as unknown,
    _headers,
    set(key: string, val: string) {
      _headers[key.toLowerCase()] = val;
    },
    ...overrides,
  };
}

describe("agentAuth", () => {
  const config = {
    issuer: "https://auth.example.com",
    authorizationUrl: "https://auth.example.com/authorize",
    tokenUrl: "https://auth.example.com/token",
    scopes: { read: "Read access", write: "Write access" },
  };

  it("oauthDiscovery returns the discovery document", () => {
    const handlers = agentAuth(config);
    const ctx = mockCtx();

    handlers.oauthDiscovery(ctx);

    expect(ctx.body).toEqual({
      issuer: "https://auth.example.com",
      authorization_endpoint: "https://auth.example.com/authorize",
      token_endpoint: "https://auth.example.com/token",
      scopes_supported: ["read", "write"],
    });
  });

  it("requireAuth returns 401 when no Authorization header", async () => {
    const handlers = agentAuth(config);
    const middleware = handlers.requireAuth();
    const ctx = mockCtx();
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body.error.code).toBe("authentication_required");
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAuth sets WWW-Authenticate header", async () => {
    const handlers = agentAuth(config);
    const middleware = handlers.requireAuth();
    const ctx = mockCtx();

    await middleware(ctx, vi.fn());

    expect(ctx._headers["www-authenticate"]).toContain("Bearer");
    expect(ctx._headers["www-authenticate"]).toContain("realm=");
  });

  it("requireAuth calls next when Authorization header is present", async () => {
    const handlers = agentAuth(config);
    const middleware = handlers.requireAuth();
    const ctx = mockCtx({ headers: { authorization: "Bearer token123" } });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.status).toBe(200);
  });

  it("uses custom realm", async () => {
    const handlers = agentAuth({ ...config, realm: "my-api" });
    const middleware = handlers.requireAuth();
    const ctx = mockCtx();

    await middleware(ctx, vi.fn());

    expect(ctx._headers["www-authenticate"]).toContain('realm="my-api"');
  });
});
