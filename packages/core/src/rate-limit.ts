import type { RateLimitConfig, RateLimitResult, RateLimitStore } from "./types.js";

/**
 * In-memory sliding window counter store.
 * Entries are automatically cleaned up when they expire.
 */
export class MemoryStore implements RateLimitStore {
  private windows = new Map<string, { count: number; expiresAt: number }>();

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const entry = this.windows.get(key);

    if (!entry || now >= entry.expiresAt) {
      this.windows.set(key, { count: 1, expiresAt: now + windowMs });
      return 1;
    }

    entry.count += 1;
    return entry.count;
  }

  async get(key: string): Promise<number> {
    const now = Date.now();
    const entry = this.windows.get(key);

    if (!entry || now >= entry.expiresAt) {
      return 0;
    }

    return entry.count;
  }

  async reset(key: string): Promise<void> {
    this.windows.delete(key);
  }

  /** Remove expired entries. Useful for long-running processes. */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (now >= entry.expiresAt) {
        this.windows.delete(key);
      }
    }
  }
}

const DEFAULT_WINDOW_MS = 60_000;

/**
 * Create a rate limiter with the given configuration.
 * Returns a function that checks whether a request is allowed.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
  const store = config.store ?? new MemoryStore();
  const keyFn = config.keyFn ?? (() => "__global__");

  return async function checkRateLimit(req: unknown): Promise<RateLimitResult> {
    const key = keyFn(req);
    const count = await store.increment(key, windowMs);
    const allowed = count <= config.max;
    const remaining = Math.max(0, config.max - count);

    const result: RateLimitResult = {
      allowed,
      limit: config.max,
      remaining,
      resetMs: windowMs,
    };

    if (!allowed) {
      result.retryAfter = Math.ceil(windowMs / 1000);
    }

    return result;
  };
}
