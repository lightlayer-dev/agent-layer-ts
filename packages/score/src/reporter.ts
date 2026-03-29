/**
 * Terminal output reporter with colors and badges.
 */

import chalk from "chalk";
import type { ScoreReport, CheckResult } from "./types.js";

function icon(severity: CheckResult["severity"]): string {
  switch (severity) {
    case "pass":
      return chalk.green("✅");
    case "warn":
      return chalk.yellow("⚠️ ");
    case "fail":
      return chalk.red("❌");
  }
}

function scoreColor(score: number): (text: string) => string {
  if (score >= 80) return chalk.green;
  if (score >= 50) return chalk.yellow;
  return chalk.red;
}

function gradeLabel(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function formatReport(report: ScoreReport): string {
  const lines: string[] = [];
  const color = scoreColor(report.score);

  lines.push("");
  lines.push(
    chalk.bold("🤖 Agent-Readiness Score: ") +
      color(chalk.bold(`${report.score}/100`)) +
      chalk.dim(` (${gradeLabel(report.score)})`),
  );
  lines.push(chalk.dim(`   ${report.url} — ${report.durationMs}ms`));
  lines.push("");

  for (const check of report.checks) {
    const scoreStr = chalk.dim(`(${check.score}/${check.maxScore})`);
    lines.push(`  ${icon(check.severity)} ${check.name} ${scoreStr}`);
    lines.push(`     ${chalk.dim(check.message)}`);
    if (check.suggestion) {
      lines.push(`     ${chalk.cyan("💡 " + check.suggestion)}`);
    }
  }

  lines.push("");

  // Summary suggestions
  const failing = report.checks.filter((c) => c.severity === "fail");
  if (failing.length > 0) {
    lines.push(
      chalk.bold("🔧 Quick wins to improve your score:"),
    );
    for (const check of failing.slice(0, 3)) {
      if (check.suggestion) {
        lines.push(`   • ${check.suggestion}`);
      }
    }
    lines.push("");
  }

  if (report.score < 50) {
    lines.push(
      chalk.cyan(
        "💡 Add @agent-layer middleware to instantly improve your score:",
      ),
    );
    lines.push(chalk.cyan("   npm install @agent-layer/core @agent-layer/express"));
    lines.push("");
  }

  return lines.join("\n");
}

/** Generate a shields.io badge URL for the score. */
export function badgeUrl(score: number, label = "Agent-Ready"): string {
  const color =
    score >= 80 ? "brightgreen" : score >= 50 ? "yellow" : "red";
  return `https://img.shields.io/badge/${encodeURIComponent(label)}-${score}%2F100-${color}?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQyIDAtOC0zLjU4LTgtOHMzLjU4LTggOC04IDggMy41OCA4IDgtMy41OCA4LTggOHoiLz48L3N2Zz4=&link=https://github.com/lightlayer-dev/agent-layer-ts`;
}

/**
 * Generate the full markdown badge with link for READMEs.
 * Links back to the agent-layer repo for brand attribution.
 */
export function badgeMarkdown(score: number, label = "Agent-Ready"): string {
  const url = badgeUrl(score, label);
  return `[![${label}: ${score}/100](${url})](https://github.com/lightlayer-dev/agent-layer-ts "Scored by @agent-layer/score")`;
}

/** Format report as JSON (for --json flag). */
export function formatJson(report: ScoreReport): string {
  return JSON.stringify(report, null, 2);
}
