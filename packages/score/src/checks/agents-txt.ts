/**
 * Check: agents.txt — robots.txt-style permission system for AI agents.
 * Checks for /agents.txt at the site root.
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch, resolveUrl } from "./utils.js";

export async function checkAgentsTxt(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "agents-txt",
    name: "agents.txt Permissions",
    score: 0,
    maxScore: 10,
    severity: "fail",
    message: "",
  };

  const url = resolveUrl(config.url, "/agents.txt");
  const res = await safeFetch(url, config);

  if (!res || res.status >= 400) {
    return {
      ...base,
      message: "No agents.txt found — AI agents can't discover permissions",
      suggestion:
        "Add /agents.txt to declare which agents can access your site and what they're allowed to do. Use @agent-layer agents-txt middleware.",
      details: { status: res?.status ?? 0 },
    };
  }

  let body = "";
  try {
    body = await res.text();
  } catch {
    /* empty */
  }

  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const hasUserAgent = lines.some((l) =>
    l.toLowerCase().startsWith("user-agent:"),
  );
  const hasAllow = lines.some((l) => l.toLowerCase().startsWith("allow:"));
  const hasDisallow = lines.some((l) =>
    l.toLowerCase().startsWith("disallow:"),
  );
  const hasAuth = lines.some((l) => l.toLowerCase().startsWith("auth:"));
  const hasRateLimit = lines.some((l) =>
    l.toLowerCase().startsWith("rate-limit:"),
  );

  const features: string[] = [];
  if (hasUserAgent) features.push("agent targeting");
  if (hasAllow || hasDisallow) features.push("path rules");
  if (hasAuth) features.push("auth requirements");
  if (hasRateLimit) features.push("rate limits");

  const details = {
    status: res.status,
    lineCount: lines.length,
    hasUserAgent,
    hasAllow,
    hasDisallow,
    hasAuth,
    hasRateLimit,
  };

  if (features.length >= 3) {
    return {
      ...base,
      score: 10,
      severity: "pass",
      message: `agents.txt with ${features.join(", ")}`,
      details,
    };
  } else if (features.length >= 1) {
    return {
      ...base,
      score: 6,
      severity: "warn",
      message: `agents.txt found with ${features.join(", ")} — consider adding more directives`,
      suggestion:
        "Add auth requirements and rate limits to give agents clear usage boundaries",
      details,
    };
  } else {
    return {
      ...base,
      score: 3,
      severity: "warn",
      message: "agents.txt exists but contains no recognized directives",
      suggestion:
        "Add User-Agent, Allow/Disallow, and rate-limit directives. See @agent-layer docs.",
      details,
    };
  }
}
