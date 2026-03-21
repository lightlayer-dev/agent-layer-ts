import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { MemoryApiKeyStore, createApiKey } from "@agent-layer/core";
import { apiKeyAuth, requireScope } from "./api-keys.js";

describe("apiKeyAuth middleware", () => {
  it("returns 401 when header is missing", async () => {
    const store = new MemoryApiKeyStore();
    const app = new Hono();
    app.use("*", apiKeyAuth({ store }));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/");

    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe("api_key_missing");
  });

  it("returns 401 for an invalid key", async () => {
    const store = new MemoryApiKeyStore();
    const app = new Hono();
    app.use("*", apiKeyAuth({ store }));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/", {
      headers: { "x-agent-key": "al_bogus" },
    });

    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe("invalid_api_key");
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

    const app = new Hono();
    app.use("*", apiKeyAuth({ store }));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/", {
      headers: { "x-agent-key": rawKey },
    });

    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe("api_key_expired");
    vi.useRealTimers();
  });

  it("calls next for valid key", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
    });

    const app = new Hono();
    app.use("*", apiKeyAuth({ store }));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/", {
      headers: { "x-agent-key": rawKey },
    });

    expect(res.status).toBe(200);
  });

  it("uses custom header name", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
    });

    const app = new Hono();
    app.use("*", apiKeyAuth({ store, headerName: "Authorization" }));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/", {
      headers: { authorization: rawKey },
    });

    expect(res.status).toBe(200);
  });
});

describe("requireScope middleware", () => {
  it("returns 401 when no agentKey is present", async () => {
    const app = new Hono();
    app.use("*", requireScope("read"));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/");

    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe("api_key_missing");
  });

  it("returns 403 when scope is insufficient", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
    });

    const app = new Hono();
    app.use("*", apiKeyAuth({ store }));
    app.use("*", requireScope("admin"));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/", {
      headers: { "x-agent-key": rawKey },
    });

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error.code).toBe("insufficient_scope");
  });

  it("calls next when scope matches", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read", "write"],
    });

    const app = new Hono();
    app.use("*", apiKeyAuth({ store }));
    app.use("*", requireScope("read"));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/", {
      headers: { "x-agent-key": rawKey },
    });

    expect(res.status).toBe(200);
  });
});
