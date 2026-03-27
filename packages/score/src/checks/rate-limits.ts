/**
 * Check: Rate limit headers on responses.
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch } from "./utils.js";

const RATE_LIMIT_HEADERS = [
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "ratelimit-limit",
  "ratelimit-remaining",
  "ratelimit-reset",
  "ratelimit-policy",
  "retry-after",
  "x-rate-limit-limit",
  "x-rate-limit-remaining",
];

export async function checkRateLimits(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "rate-limits",
    name: "Rate Limit Headers",
    score: 0,
    maxScore: 10,
    severity: "fail",
    message: "",
  };

  const res = await safeFetch(config.url, config);
  if (!res) {
    return {
      ...base,
      message: "Could not reach the server",
    };
  }

  const foundHeaders: string[] = [];
  for (const header of RATE_LIMIT_HEADERS) {
    if (res.headers.get(header)) {
      foundHeaders.push(header);
    }
  }

  const details = {
    foundHeaders,
    totalChecked: RATE_LIMIT_HEADERS.length,
  };

  if (foundHeaders.length === 0) {
    return {
      ...base,
      message: "No rate limit headers found",
      suggestion:
        "Add rate limit headers so agents can self-throttle — @agent-layer rateLimits() middleware handles this",
      details,
    };
  }

  const hasLimit = foundHeaders.some(
    (h) => h.includes("limit") && !h.includes("remaining") && !h.includes("reset"),
  );
  const hasRemaining = foundHeaders.some((h) => h.includes("remaining"));
  const hasReset = foundHeaders.some(
    (h) => h.includes("reset") || h === "retry-after",
  );

  let score = 4; // Has some rate limit headers
  if (hasLimit) score += 2;
  if (hasRemaining) score += 2;
  if (hasReset) score += 2;

  score = Math.min(score, 10);

  return {
    ...base,
    score,
    severity: score >= 8 ? "pass" : "warn",
    message: `Found rate limit headers: ${foundHeaders.join(", ")}`,
    suggestion:
      score < 10
        ? "Include limit, remaining, and reset headers for complete agent rate-limit awareness"
        : undefined,
    details,
  };
}
