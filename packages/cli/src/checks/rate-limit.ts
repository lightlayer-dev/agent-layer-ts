import type { CheckResult } from "./index.js";

/**
 * Rate Limit Headers (10 pts)
 * Check for X-RateLimit-* or RateLimit-* headers on any response
 */
export async function checkRateLimit(baseUrl: string): Promise<CheckResult> {
  const maxScore = 10;
  const label = "Rate limit headers";

  try {
    const res = await fetch(baseUrl);
    const headers = Object.fromEntries(res.headers.entries());

    const rateLimitHeaders = Object.keys(headers).filter(
      (h) =>
        h.toLowerCase().startsWith("x-ratelimit") ||
        h.toLowerCase().startsWith("ratelimit") ||
        h.toLowerCase() === "retry-after",
    );

    if (rateLimitHeaders.length === 0) {
      return {
        score: 0,
        maxScore,
        label,
        detail: "No rate limit headers found",
      };
    }

    // Check for comprehensive rate limit info
    const headerNames = rateLimitHeaders.map((h) => h.toLowerCase());
    const hasLimit =
      headerNames.some((h) => h.includes("limit")) &&
      !headerNames.every((h) => h.includes("remaining"));
    const hasRemaining = headerNames.some((h) => h.includes("remaining"));
    const hasReset = headerNames.some((h) => h.includes("reset"));

    if (hasLimit && hasRemaining && hasReset) {
      return {
        score: 10,
        maxScore,
        label,
        detail: `Full rate limit info: ${rateLimitHeaders.join(", ")}`,
      };
    }

    if (hasLimit || hasRemaining) {
      return {
        score: 7,
        maxScore,
        label,
        detail: `Partial rate limit headers: ${rateLimitHeaders.join(", ")}`,
      };
    }

    return {
      score: 4,
      maxScore,
      label,
      detail: `Some rate limit headers: ${rateLimitHeaders.join(", ")}`,
    };
  } catch {
    return {
      score: 0,
      maxScore,
      label,
      detail: "Failed to connect to check rate limit headers",
    };
  }
}
