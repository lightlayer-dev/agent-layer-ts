import type { CheckResult } from "./index.js";

/**
 * llms.txt (10 pts)
 * Check /llms.txt exists and has content
 */
export async function checkLlmsTxt(baseUrl: string): Promise<CheckResult> {
  const maxScore = 10;
  const label = "llms.txt";

  try {
    const res = await fetch(`${baseUrl}/llms.txt`);

    if (!res.ok) {
      return {
        score: 0,
        maxScore,
        label,
        detail: `No /llms.txt found (HTTP ${res.status})`,
      };
    }

    const text = await res.text();

    if (!text.trim()) {
      return {
        score: 3,
        maxScore,
        label,
        detail: "/llms.txt exists but is empty",
      };
    }

    // Check for meaningful content (more than just a title)
    const lines = text.trim().split("\n").filter(Boolean);

    if (lines.length >= 3) {
      return {
        score: 10,
        maxScore,
        label,
        detail: `/llms.txt found with ${lines.length} lines of content`,
      };
    }

    return {
      score: 6,
      maxScore,
      label,
      detail: `/llms.txt found but sparse (${lines.length} lines)`,
    };
  } catch {
    return {
      score: 0,
      maxScore,
      label,
      detail: "Failed to fetch /llms.txt",
    };
  }
}
