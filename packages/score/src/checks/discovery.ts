/**
 * Check: Agent discovery endpoints (/.well-known/agent-card.json, /.well-known/agent.json, /.well-known/ai).
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch, resolveUrl } from "./utils.js";

const DISCOVERY_PATHS = [
  { path: "/.well-known/agent-card.json", name: "A2A Agent Card" },
  { path: "/.well-known/agent.json", name: "Agent JSON" },
  { path: "/.well-known/ai", name: "Well-Known AI" },
  { path: "/.well-known/ai-plugin.json", name: "AI Plugin (ChatGPT)" },
];

export async function checkDiscovery(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "discovery",
    name: "Agent Discovery Endpoints",
    score: 0,
    maxScore: 10,
    severity: "fail",
    message: "",
  };

  const found: string[] = [];
  const details: Record<string, unknown> = {};

  for (const { path, name } of DISCOVERY_PATHS) {
    const url = resolveUrl(config.url, path);
    const res = await safeFetch(url, config);
    const status = res?.status ?? 0;
    const ok = status >= 200 && status < 300;

    details[path] = { status, found: ok };

    if (ok) {
      found.push(name);
    }
  }

  if (found.length >= 2) {
    return {
      ...base,
      score: 10,
      severity: "pass",
      message: `Found discovery endpoints: ${found.join(", ")}`,
      details,
    };
  } else if (found.length === 1) {
    return {
      ...base,
      score: 7,
      severity: "warn",
      message: `Found: ${found[0]}. Consider adding more discovery formats.`,
      suggestion:
        "Use @agent-layer unified-discovery middleware to serve all formats from a single config",
      details,
    };
  } else {
    return {
      ...base,
      message: "No agent discovery endpoints found",
      suggestion:
        "Add /.well-known/agent-card.json (A2A) and /.well-known/agent.json — @agent-layer makes this one line of config",
      details,
    };
  }
}
