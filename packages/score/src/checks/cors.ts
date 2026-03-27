/**
 * Check: CORS headers for agent access.
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch } from "./utils.js";

export async function checkCors(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "cors",
    name: "CORS for Agents",
    score: 0,
    maxScore: 10,
    severity: "fail",
    message: "",
  };

  // Send an OPTIONS preflight-style request with Origin header
  const res = await safeFetch(config.url, config, {
    method: "OPTIONS",
    headers: {
      Origin: "https://agent.example.com",
      "Access-Control-Request-Method": "GET",
    },
  });

  // Also check a regular GET for CORS headers
  const getRes = await safeFetch(config.url, config, {
    headers: { Origin: "https://agent.example.com" },
  });

  const checkRes = res ?? getRes;
  if (!checkRes) {
    return {
      ...base,
      message: "Could not reach the server",
    };
  }

  const acao = checkRes.headers.get("access-control-allow-origin") ?? "";
  const acam = checkRes.headers.get("access-control-allow-methods") ?? "";
  const acah = checkRes.headers.get("access-control-allow-headers") ?? "";
  const maxAge = checkRes.headers.get("access-control-max-age") ?? "";

  const details = {
    allowOrigin: acao,
    allowMethods: acam,
    allowHeaders: acah,
    maxAge,
    optionsStatus: res?.status,
    getStatus: getRes?.status,
  };

  if (!acao) {
    return {
      ...base,
      message: "No CORS headers found",
      suggestion:
        "Add Access-Control-Allow-Origin headers for browser-based agents and frontend integrations",
      details,
    };
  }

  let score = 5; // Has ACAO
  if (acao === "*" || acao.includes("agent")) score += 2;
  if (acam) score += 1;
  if (acah) score += 1;
  if (maxAge) score += 1;

  score = Math.min(score, 10);

  return {
    ...base,
    score,
    severity: score >= 8 ? "pass" : "warn",
    message: `CORS: Allow-Origin=${acao || "none"}`,
    suggestion:
      score < 10
        ? "Configure CORS with Allow-Methods, Allow-Headers, and Max-Age for optimal agent access"
        : undefined,
    details,
  };
}
