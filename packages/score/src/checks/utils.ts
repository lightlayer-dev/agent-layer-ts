/**
 * Shared utilities for checks.
 */

import type { ScanConfig } from "../types.js";

/** Safe fetch with timeout and error handling. */
export async function safeFetch(
  url: string,
  config: ScanConfig,
  options: RequestInit = {},
): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": config.userAgent,
        ...((options.headers as Record<string, string>) ?? {}),
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    return res;
  } catch {
    return null;
  }
}

/** Resolve a path against the base URL. */
export function resolveUrl(base: string, path: string): string {
  const u = new URL(base);
  u.pathname = path;
  u.search = "";
  u.hash = "";
  return u.toString();
}
