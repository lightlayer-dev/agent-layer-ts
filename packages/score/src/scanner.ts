/**
 * Core scanner — runs all checks and produces a ScoreReport.
 */

import type { ScoreReport, ScanConfig, CheckFn } from "./types.js";
import { allChecks } from "./checks/index.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = "AgentLayerScore/0.1 (https://company.lightlayer.dev)";

export interface ScanOptions {
  url: string;
  timeoutMs?: number;
  userAgent?: string;
  checks?: CheckFn[];
}

export async function scan(options: ScanOptions): Promise<ScoreReport> {
  // Normalize URL
  let url = options.url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  const config: ScanConfig = {
    url,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
  };

  const checksToRun = options.checks ?? allChecks;
  const start = Date.now();

  const checks = await Promise.all(
    checksToRun.map((check) => check(config)),
  );

  const totalScore = checks.reduce((sum, c) => sum + c.score, 0);
  const maxScore = checks.reduce((sum, c) => sum + c.maxScore, 0);
  const normalizedScore = Math.round((totalScore / maxScore) * 100);

  return {
    url,
    timestamp: new Date().toISOString(),
    score: normalizedScore,
    checks,
    durationMs: Date.now() - start,
  };
}
