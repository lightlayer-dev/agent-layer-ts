/**
 * Agent-readiness scoring types.
 */

/** Severity level for a check result. */
export type CheckSeverity = "pass" | "warn" | "fail";

/** Result of a single check. */
export interface CheckResult {
  /** Check identifier (e.g. "structured-errors") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Score out of maxScore */
  score: number;
  /** Maximum possible score */
  maxScore: number;
  /** Pass / warn / fail */
  severity: CheckSeverity;
  /** Short description of what was found */
  message: string;
  /** Suggestion for improvement (if not perfect score) */
  suggestion?: string;
  /** Raw details for --json output */
  details?: Record<string, unknown>;
}

/** Overall score report for a URL. */
export interface ScoreReport {
  /** URL that was scored */
  url: string;
  /** ISO timestamp of the scan */
  timestamp: string;
  /** Total score (0-100) */
  score: number;
  /** Individual check results */
  checks: CheckResult[];
  /** Duration of the scan in ms */
  durationMs: number;
}

/** Configuration for running checks. */
export interface ScanConfig {
  /** Target URL */
  url: string;
  /** Request timeout in ms */
  timeoutMs: number;
  /** User-Agent string to use */
  userAgent: string;
}

/** A check function signature. */
export type CheckFn = (config: ScanConfig) => Promise<CheckResult>;
