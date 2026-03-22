/**
 * Check: /llms.txt presence and quality.
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch, resolveUrl } from "./utils.js";

export async function checkLlmsTxt(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "llms-txt",
    name: "llms.txt",
    score: 0,
    maxScore: 10,
    severity: "fail",
    message: "",
  };

  const paths = ["/llms.txt", "/llms-full.txt"];
  const found: { path: string; length: number; hasStructure: boolean }[] = [];
  const details: Record<string, unknown> = {};

  for (const path of paths) {
    const url = resolveUrl(config.url, path);
    const res = await safeFetch(url, config);

    if (res && res.status >= 200 && res.status < 300) {
      const text = await res.text();
      const hasStructure = text.includes("#") || text.includes(">");
      found.push({ path, length: text.length, hasStructure });
      details[path] = {
        status: res.status,
        length: text.length,
        hasStructure,
      };
    } else {
      details[path] = { status: res?.status ?? 0, found: false };
    }
  }

  if (found.length === 0) {
    return {
      ...base,
      message: "No llms.txt found",
      suggestion:
        "Add /llms.txt to describe your site for LLMs — @agent-layer llmsTxt() middleware generates it automatically",
      details,
    };
  }

  const best = found[0];
  let score = 5;
  const notes: string[] = [`Found ${best.path} (${best.length} chars)`];

  if (best.hasStructure) {
    score += 2;
    notes.push("has markdown structure");
  }
  if (best.length > 200) {
    score += 1;
    notes.push("good content length");
  }
  if (found.length > 1) {
    score += 2;
    notes.push("has llms-full.txt variant too");
  }

  score = Math.min(score, 10);

  return {
    ...base,
    score,
    severity: score >= 8 ? "pass" : "warn",
    message: notes.join("; "),
    suggestion: score < 10 ? "Consider adding both /llms.txt and /llms-full.txt with structured markdown content" : undefined,
    details,
  };
}
