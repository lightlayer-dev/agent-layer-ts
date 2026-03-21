import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { rateLimits } from "./rate-limits.js";

describe("rateLimits middleware", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sets X-RateLimit-* headers on allowed requests", async () => {
    const app = new Hono();
    app.use("*", rateLimits({ max: 10 }));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/");

    expect(res.headers.get("x-ratelimit-limit")).toBe("10");
    expect(res.headers.get("x-ratelimit-remaining")).toBe("9");
    expect(res.headers.get("x-ratelimit-reset")).toBeTruthy();
    expect(res.status).toBe(200);
  });

  it("returns 429 when limit exceeded", async () => {
    const app = new Hono();
    app.use("*", rateLimits({ max: 1 }));
    app.get("/", (c) => c.json({ ok: true }));

    await app.request("/");
    const res = await app.request("/");

    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error.code).toBe("rate_limit_exceeded");
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("sets remaining to 0 on blocked requests", async () => {
    const app = new Hono();
    app.use("*", rateLimits({ max: 1 }));
    app.get("/", (c) => c.json({ ok: true }));

    await app.request("/");
    const res = await app.request("/");

    expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
  });

  it("allows requests again after window expires", async () => {
    const app = new Hono();
    app.use("*", rateLimits({ max: 1, windowMs: 1000 }));
    app.get("/", (c) => c.json({ ok: true }));

    await app.request("/");
    vi.advanceTimersByTime(1001);

    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
  });
});
