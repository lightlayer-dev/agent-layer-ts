/**
 * Check: Security headers that don't unnecessarily block agents.
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch } from "./utils.js";

export async function checkSecurityHeaders(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "security-headers",
    name: "Security Headers",
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

  const hsts = res.headers.get("strict-transport-security") ?? "";
  const xcto = res.headers.get("x-content-type-options") ?? "";
  const xfo = res.headers.get("x-frame-options") ?? "";
  const csp = res.headers.get("content-security-policy") ?? "";
  const referrer = res.headers.get("referrer-policy") ?? "";

  const details = {
    hsts: hsts || null,
    xContentTypeOptions: xcto || null,
    xFrameOptions: xfo || null,
    csp: csp ? csp.substring(0, 200) : null,
    referrerPolicy: referrer || null,
  };

  let score = 0;
  const present: string[] = [];

  if (hsts) {
    score += 3;
    present.push("HSTS");
  }
  if (xcto) {
    score += 2;
    present.push("X-Content-Type-Options");
  }
  if (xfo) {
    score += 1;
    present.push("X-Frame-Options");
  }
  if (referrer) {
    score += 2;
    present.push("Referrer-Policy");
  }
  if (csp) {
    score += 2;
    present.push("CSP");
  }

  score = Math.min(score, 10);

  if (present.length === 0) {
    return {
      ...base,
      message: "No security headers found",
      suggestion: "Add HSTS, X-Content-Type-Options, and Referrer-Policy headers",
      details,
    };
  }

  return {
    ...base,
    score,
    severity: score >= 8 ? "pass" : score >= 4 ? "warn" : "fail",
    message: `Security headers: ${present.join(", ")}`,
    suggestion:
      score < 10
        ? `Missing: ${["HSTS", "X-Content-Type-Options", "Referrer-Policy", "CSP"].filter((h) => !present.includes(h)).join(", ")}`
        : undefined,
    details,
  };
}
