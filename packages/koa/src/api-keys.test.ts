import { describe, it, expect, vi } from "vitest";
import { MemoryApiKeyStore, createApiKey } from "@agent-layer/core";
import { apiKeyAuth, requireScope } from "./api-keys.js";

function mockCtx(overrides: Record<string, unknown> = {}): any {
  const headers: Record<string, string> = {};
  return {
    request: { headers: {}, ...overrides },
    headers: (overrides.headers as Record<string, string>) ?? {},
    state: (overrides.state as Record<string, unknown>) ?? {},
    status: 200,
    body: null as unknown,
    _headers: headers,
    set(key: string, val: string) {
      headers[key.toLowerCase()] = val;
    },
    get response() {
      return { headers };
    },
  };
}

describe("apiKeyAuth middleware", () => {
  it("returns 401 when header is missing", async () => {
    const store = new MemoryApiKeyStore();
    const middleware = apiKeyAuth({ store });
    const ctx = mockCtx();
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body.error.code).toBe("api_key_missing");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalid key", async () => {
    const store = new MemoryApiKeyStore();
    const middleware = apiKeyAuth({ store });
    const ctx = mockCtx({ headers: { "x-agent-key": "al_bogus" } });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body.error.code).toBe("invalid_api_key");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for an expired key", async () => {
    vi.useFakeTimers();
    const store = new MemoryApiKeyStore();
    const { rawKey } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
      expiresAt: new Date(Date.now() + 1000),
    });

    vi.advanceTimersByTime(1001);

    const middleware = apiKeyAuth({ store });
    const ctx = mockCtx({ headers: { "x-agent-key": rawKey } });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body.error.code).toBe("api_key_expired");
    expect(next).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("attaches agentKey to state and calls next for valid key", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey, key } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
    });

    const middleware = apiKeyAuth({ store });
    const ctx = mockCtx({ headers: { "x-agent-key": rawKey } });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.state.agentKey).toEqual(key);
    expect(next).toHaveBeenCalled();
  });

  it("uses custom header name", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
    });

    const middleware = apiKeyAuth({ store, headerName: "Authorization" });
    const ctx = mockCtx({ headers: { authorization: rawKey } });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it("propagates store errors", async () => {
    const errorStore = {
      resolve: async () => { throw new Error("store error"); },
    };
    const middleware = apiKeyAuth({ store: errorStore });
    const ctx = mockCtx({ headers: { "x-agent-key": "al_anything" } });

    await expect(middleware(ctx, vi.fn())).rejects.toThrow("store error");
  });
});

describe("requireScope middleware", () => {
  it("returns 401 when no agentKey is present", async () => {
    const middleware = requireScope("read");
    const ctx = mockCtx();
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body.error.code).toBe("api_key_missing");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when scope is insufficient", async () => {
    const middleware = requireScope("admin");
    const ctx = mockCtx({
      state: {
        agentKey: { keyId: "k1", companyId: "c1", userId: "u1", scopes: ["read"] },
      },
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.status).toBe(403);
    expect(ctx.body.error.code).toBe("insufficient_scope");
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when scope matches", async () => {
    const middleware = requireScope("read");
    const ctx = mockCtx({
      state: {
        agentKey: { keyId: "k1", companyId: "c1", userId: "u1", scopes: ["read", "write"] },
      },
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it("calls next with wildcard scope", async () => {
    const middleware = requireScope(["read", "write", "admin"]);
    const ctx = mockCtx({
      state: {
        agentKey: { keyId: "k1", companyId: "c1", userId: "u1", scopes: ["*"] },
      },
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it("checks multiple required scopes", async () => {
    const middleware = requireScope(["read", "write"]);
    const ctx = mockCtx({
      state: {
        agentKey: { keyId: "k1", companyId: "c1", userId: "u1", scopes: ["read"] },
      },
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.status).toBe(403);
    expect(ctx.body.error.code).toBe("insufficient_scope");
  });
});
