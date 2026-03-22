/**
 * Check: robots.txt presence and AI agent rules.
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch, resolveUrl } from "./utils.js";

const AI_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "Anthropic",
  "ClaudeBot",
  "CCBot",
  "Amazonbot",
  "Bytespider",
  "Applebot-Extended",
  "PerplexityBot",
  "Cohere-ai",
];

export async function checkRobotsTxt(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "robots-txt",
    name: "robots.txt Agent Rules",
    score: 0,
    maxScore: 10,
    severity: "fail",
    message: "",
  };

  const url = resolveUrl(config.url, "/robots.txt");
  const res = await safeFetch(url, config);

  if (!res) {
    return {
      ...base,
      message: "Could not reach the server",
      details: { status: 0 },
    };
  }

  if (res.status >= 400) {
    return {
      ...base,
      score: 3,
      severity: "warn",
      message: "No robots.txt found — agents will assume full access",
      suggestion: "Add robots.txt with explicit AI agent rules to signal intentional access control",
      details: { status: res.status },
    };
  }

  const text = await res.text();
  const lines = text.toLowerCase();

  const mentionedAgents = AI_AGENTS.filter((a) =>
    lines.includes(a.toLowerCase()),
  );
  const hasWildcard = lines.includes("user-agent: *");
  const hasSitemap = lines.includes("sitemap:");

  const details = {
    hasRobotsTxt: true,
    mentionedAiAgents: mentionedAgents,
    hasWildcardRule: hasWildcard,
    hasSitemap,
    length: text.length,
  };

  let score = 4; // Has robots.txt

  if (mentionedAgents.length > 0) {
    score += Math.min(mentionedAgents.length, 3); // Up to +3 for mentioning AI agents
  }
  if (hasSitemap) score += 1;
  if (hasWildcard) score += 1;
  if (mentionedAgents.length >= 3) score += 1;

  score = Math.min(score, 10);

  const messages: string[] = ["robots.txt found"];
  if (mentionedAgents.length > 0) {
    messages.push(`mentions ${mentionedAgents.length} AI agents`);
  } else {
    messages.push("no AI-specific agent rules");
  }

  return {
    ...base,
    score,
    severity: score >= 8 ? "pass" : score >= 5 ? "warn" : "fail",
    message: messages.join("; "),
    suggestion:
      score < 10
        ? "Add explicit rules for AI agents (GPTBot, ClaudeBot, etc.) to communicate your access policy"
        : undefined,
    details,
  };
}
