import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MemoryApiKeyStore,
  createApiKey,
  validateApiKey,
  hasScope,
} from "./api-keys.js";
import type { ScopedApiKey } from "./api-keys.js";

describe("MemoryApiKeyStore", () => {
  it("returns null for unknown keys", async () => {
    const store = new MemoryApiKeyStore();
    expect(await store.resolve("al_unknown")).toBeNull();
  });

  it("stores and resolves keys", async () => {
    const store = new MemoryApiKeyStore();
    const key: ScopedApiKey = {
      keyId: "k1",
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
    };
    store.set("al_abc123", key);
    expect(await store.resolve("al_abc123")).toEqual(key);
  });

  it("deletes keys", async () => {
    const store = new MemoryApiKeyStore();
    const key: ScopedApiKey = {
      keyId: "k1",
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
    };
    store.set("al_abc123", key);
    store.delete("al_abc123");
    expect(await store.resolve("al_abc123")).toBeNull();
  });

  it("tracks size", async () => {
    const store = new MemoryApiKeyStore();
    expect(store.size).toBe(0);
    store.set("al_k1", { keyId: "k1", companyId: "c1", userId: "u1", scopes: [] });
    expect(store.size).toBe(1);
    store.set("al_k2", { keyId: "k2", companyId: "c1", userId: "u1", scopes: [] });
    expect(store.size).toBe(2);
    store.delete("al_k1");
    expect(store.size).toBe(1);
  });
});

describe("createApiKey", () => {
  it("generates a key with al_ prefix", () => {
    const store = new MemoryApiKeyStore();
    const { rawKey, key } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read", "write"],
    });

    expect(rawKey).toMatch(/^al_[0-9a-f]{32}$/);
    expect(key.companyId).toBe("c1");
    expect(key.userId).toBe("u1");
    expect(key.scopes).toEqual(["read", "write"]);
    expect(key.keyId).toBeDefined();
  });

  it("stores the key so it can be resolved", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey, key } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
    });

    const resolved = await store.resolve(rawKey);
    expect(resolved).toEqual(key);
  });

  it("includes optional expiresAt and metadata", () => {
    const store = new MemoryApiKeyStore();
    const expiresAt = new Date("2030-01-01");
    const { key } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
      expiresAt,
      metadata: { tier: "premium" },
    });

    expect(key.expiresAt).toEqual(expiresAt);
    expect(key.metadata).toEqual({ tier: "premium" });
  });

  it("omits expiresAt and metadata when not provided", () => {
    const store = new MemoryApiKeyStore();
    const { key } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: [],
    });

    expect(key.expiresAt).toBeUndefined();
    expect(key.metadata).toBeUndefined();
  });

  it("generates unique keys each time", () => {
    const store = new MemoryApiKeyStore();
    const opts = { companyId: "c1", userId: "u1", scopes: ["read"] };
    const { rawKey: k1 } = createApiKey(store, opts);
    const { rawKey: k2 } = createApiKey(store, opts);
    expect(k1).not.toBe(k2);
  });
});

describe("validateApiKey", () => {
  it("returns valid for a known, non-expired key", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey, key } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
    });

    const result = await validateApiKey(store, rawKey);
    expect(result.valid).toBe(true);
    expect(result.key).toEqual(key);
    expect(result.error).toBeUndefined();
  });

  it("returns invalid for an unknown key", async () => {
    const store = new MemoryApiKeyStore();
    const result = await validateApiKey(store, "al_doesnotexist");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_api_key");
    expect(result.key).toBeUndefined();
  });

  it("returns invalid for an expired key", async () => {
    vi.useFakeTimers();
    const store = new MemoryApiKeyStore();
    const { rawKey } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
      expiresAt: new Date(Date.now() + 1000),
    });

    // Before expiry — valid
    const before = await validateApiKey(store, rawKey);
    expect(before.valid).toBe(true);

    // After expiry — invalid
    vi.advanceTimersByTime(1001);
    const after = await validateApiKey(store, rawKey);
    expect(after.valid).toBe(false);
    expect(after.error).toBe("api_key_expired");

    vi.useRealTimers();
  });

  it("returns valid for a key with no expiry", async () => {
    const store = new MemoryApiKeyStore();
    const { rawKey } = createApiKey(store, {
      companyId: "c1",
      userId: "u1",
      scopes: ["read"],
    });

    const result = await validateApiKey(store, rawKey);
    expect(result.valid).toBe(true);
  });
});

describe("hasScope", () => {
  const key: ScopedApiKey = {
    keyId: "k1",
    companyId: "c1",
    userId: "u1",
    scopes: ["read", "write"],
  };

  it("returns true for a single matching scope", () => {
    expect(hasScope(key, "read")).toBe(true);
  });

  it("returns false for a single non-matching scope", () => {
    expect(hasScope(key, "admin")).toBe(false);
  });

  it("returns true when all required scopes match", () => {
    expect(hasScope(key, ["read", "write"])).toBe(true);
  });

  it("returns false when some required scopes are missing", () => {
    expect(hasScope(key, ["read", "admin"])).toBe(false);
  });

  it("returns true for wildcard scope", () => {
    const wildcardKey: ScopedApiKey = {
      keyId: "k2",
      companyId: "c1",
      userId: "u1",
      scopes: ["*"],
    };
    expect(hasScope(wildcardKey, "anything")).toBe(true);
    expect(hasScope(wildcardKey, ["read", "write", "admin"])).toBe(true);
  });

  it("returns true for empty required scopes array", () => {
    expect(hasScope(key, [])).toBe(true);
  });
});
