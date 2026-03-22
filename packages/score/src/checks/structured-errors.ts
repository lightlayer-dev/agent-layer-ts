/**
 * Check: Structured JSON errors instead of HTML error pages.
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch, resolveUrl } from "./utils.js";

export async function checkStructuredErrors(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "structured-errors",
    name: "Structured JSON Errors",
    score: 0,
    maxScore: 10,
    severity: "fail",
    message: "",
  };

  // Hit a path that's likely to 404
  const testPaths = [
    "/__agent_layer_probe_404__",
    "/api/__nonexistent__",
    "/v1/__nonexistent__",
  ];

  let jsonErrors = 0;
  let totalResponses = 0;
  const details: Record<string, unknown> = {};

  for (const path of testPaths) {
    const url = resolveUrl(config.url, path);
    const res = await safeFetch(url, config);
    if (!res) continue;

    totalResponses++;
    const ct = res.headers.get("content-type") ?? "";
    const isJson = ct.includes("application/json") || ct.includes("application/problem+json");

    details[path] = {
      status: res.status,
      contentType: ct,
      isJson,
    };

    if (isJson) {
      jsonErrors++;
    }
  }

  if (totalResponses === 0) {
    return {
      ...base,
      message: "Could not reach the server to test error responses",
      details,
    };
  }

  const ratio = jsonErrors / totalResponses;
  if (ratio >= 1) {
    return {
      ...base,
      score: 10,
      severity: "pass",
      message: "Error responses return structured JSON",
      details,
    };
  } else if (ratio > 0) {
    return {
      ...base,
      score: 5,
      severity: "warn",
      message: `${jsonErrors}/${totalResponses} error responses return JSON (some return HTML)`,
      suggestion:
        "Use @agent-layer/core errorEnvelope() to ensure all errors return structured JSON",
      details,
    };
  } else {
    return {
      ...base,
      message: "Error responses return HTML instead of structured JSON",
      suggestion:
        "Use @agent-layer/core errorEnvelope() to wrap errors in agent-friendly JSON",
      details,
    };
  }
}
