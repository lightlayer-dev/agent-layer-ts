import type { ScoreResult } from "./scorer.js";

// ANSI color codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const BG_GREEN = "\x1b[42m";
const BG_RED = "\x1b[41m";
const BG_YELLOW = "\x1b[43m";
const WHITE = "\x1b[37m";

function getScoreColor(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8) return GREEN;
  if (pct >= 0.4) return YELLOW;
  return RED;
}

function getScoreBg(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8) return BG_GREEN;
  if (pct >= 0.4) return BG_YELLOW;
  return BG_RED;
}

function getIcon(score: number, max: number): string {
  if (score === max) return "✅";
  if (score === 0) return "❌";
  return "⚠️ ";
}

function getGrade(pct: number): string {
  if (pct >= 0.9) return "A+";
  if (pct >= 0.8) return "A";
  if (pct >= 0.7) return "B";
  if (pct >= 0.6) return "C";
  if (pct >= 0.5) return "D";
  return "F";
}

/**
 * Format score results as colorful terminal output.
 */
export function formatReport(result: ScoreResult): string {
  const { totalScore, maxScore, checks, url } = result;
  const pct = maxScore > 0 ? totalScore / maxScore : 0;
  const scoreColor = getScoreColor(totalScore, maxScore);
  const scoreBg = getScoreBg(totalScore, maxScore);
  const grade = getGrade(pct);

  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(
    `${BOLD}${CYAN}  🤖 Agent-Readiness Score${RESET}`,
  );
  lines.push(
    `${DIM}  ${url}${RESET}`,
  );
  lines.push("");

  // Big score
  lines.push(
    `  ${scoreBg}${WHITE}${BOLD}  ${totalScore}/${maxScore}  ${RESET}  ${scoreColor}${BOLD}Grade: ${grade}${RESET}`,
  );
  lines.push("");

  // Separator
  lines.push(`${DIM}  ${"─".repeat(50)}${RESET}`);
  lines.push("");

  // Individual checks
  for (const check of checks) {
    const icon = getIcon(check.score, check.maxScore);
    const color = getScoreColor(check.score, check.maxScore);
    const scoreStr = `${check.score}/${check.maxScore}`;

    lines.push(
      `  ${icon} ${BOLD}${check.label}${RESET} ${color}(${scoreStr})${RESET}`,
    );
    lines.push(`     ${DIM}${check.detail}${RESET}`);
  }

  lines.push("");
  lines.push(`${DIM}  ${"─".repeat(50)}${RESET}`);
  lines.push("");

  // Improvement suggestion
  if (pct < 1) {
    lines.push(
      `  ${MAGENTA}💡 Improve your score with @agent-layer/express:${RESET}`,
    );
    lines.push(
      `     ${DIM}npm install @agent-layer/core @agent-layer/express${RESET}`,
    );
    lines.push("");
  } else {
    lines.push(
      `  ${GREEN}🎉 Perfect score! Your API is fully agent-ready!${RESET}`,
    );
    lines.push("");
  }

  return lines.join("\n");
}
