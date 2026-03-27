import { describe, it, expect, vi } from "vitest";
import { MemoryApiKeyStore, createApiKey } from "@agent-layer/core";
import { apiKeyAuth, requireScope } from "./api-keys.js";

function mockReq(overrides: Record<string, unknown> = {}): any {
  return { headers: {}, ...overrides };
}

function mockRes(): any {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
    setHeader(key: string, val: string) {
      res.headers[key.toLowerCase()] = val;
      return res;
    },
    getHeader(key: string) {
      return res.headers[key.toLowerCase()];
    },
  };
  return res;
}

describe("apiKeyAuth middleware", () => {
  it("returns 401 when header is missing", async () => {
    const store = new MemoryApiKeyStore();
    const middleware = apiKeyAuth({ store });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("api_key_missing");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalid key", async () => {
    const store = new MemoryApiKeyStore();
    const middleware = apiKeyAuth({ store });
    const req = mockReq({ headers: { "x-agent-key": "al_bogus" } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("invalid_api_key");
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
    const req = mockReq({ headers: { "x-agent-key": rawKey } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("api_key_expired");
    expect(next).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("attaches agentKey and calls next for valid key", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey, key } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
    });

    const middleware = apiKeyAuth({ store });
    const req = mockReq({ headers: { "x-agent-key": rawKey } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(req.agentKey).toEqual(key);
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
    const req = mockReq({ headers: { authorization: rawKey } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("passes store errors to next", async () => {
    const errorStore = {
      resolve: async () => { throw new Error("store error"); },
    };
    const middleware = apiKeyAuth({ store: errorStore });
    const req = mockReq({ headers: { "x-agent-key": "al_anything" } });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("requireScope middleware", () => {
  it("returns 401 when no agentKey is present", () => {
    const middleware = requireScope("read");
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("api_key_missing");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when scope is insufficient", () => {
    const middleware = requireScope("admin");
    const req = mockReq({
      agentKey: { keyId: "k1", companyId: "c1", userId: "u1", scopes: ["read"] },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("insufficient_scope");
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when scope matches", () => {
    const middleware = requireScope("read");
    const req = mockReq({
      agentKey: { keyId: "k1", companyId: "c1", userId: "u1", scopes: ["read", "write"] },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("calls next with wildcard scope", () => {
    const middleware = requireScope(["read", "write", "admin"]);
    const req = mockReq({
      agentKey: { keyId: "k1", companyId: "c1", userId: "u1", scopes: ["*"] },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("checks multiple required scopes", () => {
    const middleware = requireScope(["read", "write"]);
    const req = mockReq({
      agentKey: { keyId: "k1", companyId: "c1", userId: "u1", scopes: ["read"] },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("insufficient_scope");
  });
});
