import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { rateLimits } from "./rate-limits.js";

describe("rateLimits plugin", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sets X-RateLimit-* headers on allowed requests", async () => {
    const app = Fastify();
    await app.register(rateLimits({ max: 10 }));
    app.get("/", async () => ({ ok: true }));

    const res = await app.inject({ method: "GET", url: "/" });

    expect(res.headers["x-ratelimit-limit"]).toBe("10");
    expect(res.headers["x-ratelimit-remaining"]).toBe("9");
    expect(res.headers["x-ratelimit-reset"]).toBeDefined();
    expect(res.statusCode).toBe(200);
  });

  it("returns 429 when limit exceeded", async () => {
    const app = Fastify();
    await app.register(rateLimits({ max: 1 }));
    app.get("/", async () => ({ ok: true }));

    await app.inject({ method: "GET", url: "/" });
    const res = await app.inject({ method: "GET", url: "/" });

    expect(res.statusCode).toBe(429);
    const body = res.json();
    expect(body.error.code).toBe("rate_limit_exceeded");
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("sets remaining to 0 on blocked requests", async () => {
    const app = Fastify();
    await app.register(rateLimits({ max: 1 }));
    app.get("/", async () => ({ ok: true }));

    await app.inject({ method: "GET", url: "/" });
    const res = await app.inject({ method: "GET", url: "/" });

    expect(res.headers["x-ratelimit-remaining"]).toBe("0");
  });

  it("allows requests again after window expires", async () => {
    const app = Fastify();
    await app.register(rateLimits({ max: 1, windowMs: 1000 }));
    app.get("/", async () => ({ ok: true }));

    await app.inject({ method: "GET", url: "/" });
    vi.advanceTimersByTime(1001);

    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-ratelimit-remaining"]).toBe("0");
  });
});
