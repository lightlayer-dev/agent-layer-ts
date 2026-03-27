/**
 * Check: Proper Content-Type headers on responses.
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch } from "./utils.js";

export async function checkContentType(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "content-type",
    name: "Content-Type Headers",
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

  const ct = res.headers.get("content-type") ?? "";
  const hasCharset = ct.includes("charset=");
  const hasMediaType = ct.length > 0;
  const isSpecific = !ct.includes("application/octet-stream");

  const details = {
    contentType: ct,
    hasCharset,
    hasMediaType,
    isSpecific,
  };

  let score = 0;

  if (!hasMediaType) {
    return {
      ...base,
      message: "No Content-Type header in response",
      suggestion: "Always include Content-Type headers so agents know how to parse responses",
      details,
    };
  }

  score += 5; // Has Content-Type
  if (hasCharset) score += 3;
  if (isSpecific) score += 2;

  score = Math.min(score, 10);

  const notes: string[] = [`Content-Type: ${ct}`];
  if (!hasCharset) notes.push("missing charset");

  return {
    ...base,
    score,
    severity: score >= 8 ? "pass" : "warn",
    message: notes.join("; "),
    suggestion:
      score < 10
        ? "Include charset in Content-Type (e.g. application/json; charset=utf-8)"
        : undefined,
    details,
  };
}
