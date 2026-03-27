/**
 * Check: Response time — fast APIs are more agent-friendly.
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch } from "./utils.js";

export async function checkResponseTime(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "response-time",
    name: "Response Time",
    score: 0,
    maxScore: 10,
    severity: "fail",
    message: "",
  };

  const times: number[] = [];

  // Make 3 requests and average
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    const res = await safeFetch(config.url, config);
    const elapsed = Date.now() - start;

    if (res) {
      times.push(elapsed);
    }
  }

  if (times.length === 0) {
    return {
      ...base,
      message: "Could not reach the server",
    };
  }

  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const details = { measurements: times, averageMs: avg };

  let score: number;
  let severity: CheckResult["severity"];

  if (avg <= 200) {
    score = 10;
    severity = "pass";
  } else if (avg <= 500) {
    score = 8;
    severity = "pass";
  } else if (avg <= 1000) {
    score = 6;
    severity = "warn";
  } else if (avg <= 2000) {
    score = 4;
    severity = "warn";
  } else if (avg <= 5000) {
    score = 2;
    severity = "fail";
  } else {
    score = 1;
    severity = "fail";
  }

  return {
    ...base,
    score,
    severity,
    message: `Average response time: ${avg}ms`,
    suggestion:
      score < 8
        ? "Agents benefit from fast responses — consider caching, CDN, or optimizing backend queries"
        : undefined,
    details,
  };
}
