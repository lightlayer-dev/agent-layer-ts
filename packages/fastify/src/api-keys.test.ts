import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { apiKeyAuth, requireScope } from "./api-keys.js";
import { MemoryApiKeyStore, createApiKey } from "@agent-layer/core";

describe("apiKeyAuth (Fastify)", () => {
  it("allows requests with valid API key", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey } = await createApiKey(store, {
      name: "test",
      scopes: ["read"],
    });

    const app = Fastify();
    await app.register(apiKeyAuth({ store }));
    app.get("/test", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { "x-agent-key": rawKey },
    });

    expect(res.statusCode).toBe(200);
  });

  it("rejects requests without API key header", async () => {
    const store = new MemoryApiKeyStore();
    const app = Fastify();
    await app.register(apiKeyAuth({ store }));
    app.get("/test", async () => ({ ok: true }));

    const res = await app.inject({ method: "GET", url: "/test" });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("api_key_missing");
  });

  it("rejects invalid API key", async () => {
    const store = new MemoryApiKeyStore();
    const app = Fastify();
    await app.register(apiKeyAuth({ store }));
    app.get("/test", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { "x-agent-key": "invalid-key" },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("requireScope (Fastify)", () => {
  it("allows requests with required scope", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey } = await createApiKey(store, {
      name: "test",
      scopes: ["read", "write"],
    });

    const app = Fastify();
    await app.register(apiKeyAuth({ store }));
    app.get("/test", { preHandler: requireScope("read") }, async () => ({
      ok: true,
    }));

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { "x-agent-key": rawKey },
    });

    expect(res.statusCode).toBe(200);
  });

  it("rejects requests missing required scope", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey } = await createApiKey(store, {
      name: "test",
      scopes: ["read"],
    });

    const app = Fastify();
    await app.register(apiKeyAuth({ store }));
    app.get("/test", { preHandler: requireScope("admin") }, async () => ({
      ok: true,
    }));

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { "x-agent-key": rawKey },
    });

    expect(res.statusCode).toBe(403);
  });
});
