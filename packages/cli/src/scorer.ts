import type { Check, CheckResult } from "./checks/index.js";
import {
  checkStructuredErrors,
  checkDiscovery,
  checkLlmsTxt,
  checkAgentsTxt,
  checkRateLimit,
  checkOpenAPI,
  checkMCP,
  checkAuth,
} from "./checks/index.js";

export interface ScoreResult {
  url: string;
  totalScore: number;
  maxScore: number;
  checks: CheckResult[];
}

const ALL_CHECKS: Check[] = [
  checkStructuredErrors,
  checkDiscovery,
  checkLlmsTxt,
  checkAgentsTxt,
  checkRateLimit,
  checkOpenAPI,
  checkMCP,
  checkAuth,
];

/**
 * Run all agent-readiness checks against a URL and return the score.
 */
export async function scoreUrl(url: string): Promise<ScoreResult> {
  // Normalize URL: remove trailing slash
  const baseUrl = url.replace(/\/+$/, "");

  // Run all checks in parallel
  const checks = await Promise.all(ALL_CHECKS.map((check) => check(baseUrl)));

  const totalScore = checks.reduce((sum, c) => sum + c.score, 0);
  const maxScore = checks.reduce((sum, c) => sum + c.maxScore, 0);

  return {
    url: baseUrl,
    totalScore,
    maxScore,
    checks,
  };
}

export type { CheckResult } from "./checks/index.js";
