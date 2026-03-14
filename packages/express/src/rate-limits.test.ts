import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimits } from "./rate-limits.js";

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

describe("rateLimits middleware", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sets X-RateLimit-* headers on allowed requests", async () => {
    const middleware = rateLimits({ max: 10 });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.headers["x-ratelimit-limit"]).toBe("10");
    expect(res.headers["x-ratelimit-remaining"]).toBe("9");
    expect(res.headers["x-ratelimit-reset"]).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it("returns 429 when limit exceeded", async () => {
    const middleware = rateLimits({ max: 1 });
    const req = mockReq();
    const next = vi.fn();

    await middleware(req, mockRes(), next);

    const res2 = mockRes();
    await middleware(req, res2, vi.fn());

    expect(res2.statusCode).toBe(429);
    expect(res2.body.error.code).toBe("rate_limit_exceeded");
    expect(res2.headers["retry-after"]).toBeDefined();
  });

  it("sets remaining to 0 on blocked requests", async () => {
    const middleware = rateLimits({ max: 1 });
    const req = mockReq();

    await middleware(req, mockRes(), vi.fn());

    const res = mockRes();
    await middleware(req, res, vi.fn());

    expect(res.headers["x-ratelimit-remaining"]).toBe("0");
  });

  it("allows requests again after window expires", async () => {
    const middleware = rateLimits({ max: 1, windowMs: 1000 });
    const req = mockReq();

    await middleware(req, mockRes(), vi.fn());
    vi.advanceTimersByTime(1001);

    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.headers["x-ratelimit-remaining"]).toBe("0");
  });

  it("passes store errors to next", async () => {
    const errorStore = {
      increment: async () => { throw new Error("store error"); },
      get: async () => 0,
      reset: async () => {},
    };
    const middleware = rateLimits({ max: 10, store: errorStore });
    const next = vi.fn();

    await middleware(mockReq(), mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
