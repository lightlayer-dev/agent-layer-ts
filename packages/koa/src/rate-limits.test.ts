import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimits } from "./rate-limits.js";

function mockCtx(overrides: Record<string, unknown> = {}): any {
  const headers: Record<string, string> = {};
  return {
    request: { headers: {}, ...overrides },
    headers: {},
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

describe("rateLimits middleware", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sets X-RateLimit-* headers on allowed requests", async () => {
    const middleware = rateLimits({ max: 10 });
    const ctx = mockCtx();
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx._headers["x-ratelimit-limit"]).toBe("10");
    expect(ctx._headers["x-ratelimit-remaining"]).toBe("9");
    expect(ctx._headers["x-ratelimit-reset"]).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it("returns 429 when limit exceeded", async () => {
    const middleware = rateLimits({ max: 1 });
    const ctx = mockCtx();
    const next = vi.fn();

    await middleware(ctx, next);

    const ctx2 = mockCtx();
    await middleware(ctx2, vi.fn());

    expect(ctx2.status).toBe(429);
    expect(ctx2.body.error.code).toBe("rate_limit_exceeded");
    expect(ctx2._headers["retry-after"]).toBeDefined();
  });

  it("sets remaining to 0 on blocked requests", async () => {
    const middleware = rateLimits({ max: 1 });
    const ctx = mockCtx();

    await middleware(ctx, vi.fn());

    const ctx2 = mockCtx();
    await middleware(ctx2, vi.fn());

    expect(ctx2._headers["x-ratelimit-remaining"]).toBe("0");
  });

  it("allows requests again after window expires", async () => {
    const middleware = rateLimits({ max: 1, windowMs: 1000 });
    const ctx = mockCtx();

    await middleware(ctx, vi.fn());
    vi.advanceTimersByTime(1001);

    const ctx2 = mockCtx();
    const next = vi.fn();
    await middleware(ctx2, next);

    expect(next).toHaveBeenCalled();
    expect(ctx2._headers["x-ratelimit-remaining"]).toBe("0");
  });

  it("propagates store errors", async () => {
    const errorStore = {
      increment: async () => { throw new Error("store error"); },
      get: async () => 0,
      reset: async () => {},
    };
    const middleware = rateLimits({ max: 10, store: errorStore });

    await expect(middleware(mockCtx(), vi.fn())).rejects.toThrow("store error");
  });
});
