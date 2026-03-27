import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryStore, createRateLimiter } from "./rate-limit.js";

describe("MemoryStore", () => {
  it("starts at 0 for unknown keys", async () => {
    const store = new MemoryStore();
    expect(await store.get("unknown")).toBe(0);
  });

  it("increments and returns the count", async () => {
    const store = new MemoryStore();
    expect(await store.increment("k", 60_000)).toBe(1);
    expect(await store.increment("k", 60_000)).toBe(2);
    expect(await store.get("k")).toBe(2);
  });

  it("resets a key", async () => {
    const store = new MemoryStore();
    await store.increment("k", 60_000);
    await store.reset("k");
    expect(await store.get("k")).toBe(0);
  });

  it("expires entries after windowMs", async () => {
    vi.useFakeTimers();
    const store = new MemoryStore();
    await store.increment("k", 1000);
    expect(await store.get("k")).toBe(1);
    vi.advanceTimersByTime(1001);
    expect(await store.get("k")).toBe(0);
    vi.useRealTimers();
  });

  it("starts a new window after expiry", async () => {
    vi.useFakeTimers();
    const store = new MemoryStore();
    await store.increment("k", 1000);
    await store.increment("k", 1000);
    vi.advanceTimersByTime(1001);
    expect(await store.increment("k", 1000)).toBe(1);
    vi.useRealTimers();
  });

  it("cleanup removes expired entries", async () => {
    vi.useFakeTimers();
    const store = new MemoryStore();
    await store.increment("a", 1000);
    await store.increment("b", 5000);
    vi.advanceTimersByTime(2000);
    store.cleanup();
    expect(await store.get("a")).toBe(0);
    expect(await store.get("b")).toBe(1);
    vi.useRealTimers();
  });
});

describe("createRateLimiter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows requests under the limit", async () => {
    const check = createRateLimiter({ max: 3 });
    const r1 = await check({});
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it("blocks requests over the limit", async () => {
    const check = createRateLimiter({ max: 2 });
    await check({});
    await check({});
    const r3 = await check({});
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfter).toBeDefined();
  });

  it("uses a custom key function", async () => {
    const check = createRateLimiter({
      max: 1,
      keyFn: (req) => (req as { ip: string }).ip,
    });
    const r1 = await check({ ip: "1.1.1.1" });
    const r2 = await check({ ip: "2.2.2.2" });
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
  });

  it("resets after the window expires", async () => {
    const check = createRateLimiter({ max: 1, windowMs: 1000 });
    await check({});
    const blocked = await check({});
    expect(blocked.allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    const allowed = await check({});
    expect(allowed.allowed).toBe(true);
  });

  it("uses a custom store", async () => {
    let count = 0;
    const customStore = {
      increment: async () => ++count,
      get: async () => count,
      reset: async () => { count = 0; },
    };
    const check = createRateLimiter({ max: 2, store: customStore });
    const r1 = await check({});
    expect(r1.allowed).toBe(true);
  });
});
