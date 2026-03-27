/**
 * Check: x402 (HTTP 402 Payment Required) support for agent micropayments.
 *
 * Tests whether the server returns a proper x402-compliant 402 response
 * with payment metadata that agents can use for autonomous micropayments.
 *
 * See: https://x402.org / https://github.com/coinbase/x402
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch, resolveUrl } from "./utils.js";

const X402_HEADERS = [
  "x-payment-address",
  "x-payment-network",
  "x-payment-amount",
  "x-payment-currency",
  "x-payment-required",
];

export async function checkX402(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "x402",
    name: "x402 Agent Payments",
    score: 0,
    maxScore: 10,
    severity: "fail",
    message: "",
  };

  // Check if the server advertises x402 support anywhere
  const mainRes = await safeFetch(config.url, config);
  if (!mainRes) {
    return {
      ...base,
      message: "Could not reach the server",
    };
  }

  // Look for x402 headers on the main response
  const mainHeaders = X402_HEADERS.filter((h) => mainRes.headers.get(h));

  // Check .well-known/x402 endpoint
  const wellKnownUrl = resolveUrl(config.url, "/.well-known/x402");
  const wellKnownRes = await safeFetch(wellKnownUrl, config);
  const hasWellKnown =
    wellKnownRes !== null &&
    wellKnownRes.status >= 200 &&
    wellKnownRes.status < 300;

  // Check if any endpoint returns a proper 402
  const probeUrl = resolveUrl(config.url, "/api/__x402_probe__");
  const probeRes = await safeFetch(probeUrl, config);
  const has402 = probeRes?.status === 402;

  let paymentBody: Record<string, unknown> | null = null;
  if (has402) {
    try {
      const ct = probeRes!.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        paymentBody = JSON.parse(await probeRes!.text());
      }
    } catch {
      // ignore parse errors
    }
  }

  const details = {
    mainHeaders,
    hasWellKnown,
    has402,
    paymentBody,
  };

  // x402 is very new — this is a bonus/differentiator check
  // Score generously for any evidence of support
  if (!hasWellKnown && mainHeaders.length === 0 && !has402) {
    return {
      ...base,
      score: 0,
      severity: "fail",
      message: "No x402 payment support detected — this is a cutting-edge feature",
      suggestion:
        "Add x402 micropayment support with @agent-layer x402() middleware for monetizing agent API calls",
      details,
    };
  }

  let score = 0;
  const notes: string[] = [];

  if (hasWellKnown) {
    score += 4;
    notes.push("/.well-known/x402 endpoint found");
  }
  if (mainHeaders.length > 0) {
    score += 3;
    notes.push(`x402 headers: ${mainHeaders.join(", ")}`);
  }
  if (has402) {
    score += 3;
    notes.push("proper 402 response on protected routes");
    if (paymentBody) {
      notes.push("with structured payment metadata");
    }
  }

  score = Math.min(score, 10);

  return {
    ...base,
    score,
    severity: score >= 8 ? "pass" : score >= 4 ? "warn" : "fail",
    message: notes.join("; "),
    suggestion:
      score < 10
        ? "Implement the full x402 protocol for seamless agent micropayments"
        : undefined,
    details,
  };
}
