/**
 * @agent-layer/score — Agent-readiness scoring for APIs and websites.
 *
 * Programmatic API. For CLI usage, see the `agent-layer-score` binary.
 */

export { scan } from "./scanner.js";
export type { ScanOptions } from "./scanner.js";
export { formatReport, formatJson, badgeUrl, badgeMarkdown } from "./reporter.js";
export { allChecks } from "./checks/index.js";
export type {
  CheckResult,
  CheckSeverity,
  ScoreReport,
  ScanConfig,
  CheckFn,
} from "./types.js";
