import type { CheckResult } from "./index.js";

/**
 * agents.txt (10 pts)
 * Check /agents.txt exists and has valid format
 */
export async function checkAgentsTxt(baseUrl: string): Promise<CheckResult> {
  const maxScore = 10;
  const label = "agents.txt";

  try {
    const res = await fetch(`${baseUrl}/agents.txt`);

    if (!res.ok) {
      return {
        score: 0,
        maxScore,
        label,
        detail: `No /agents.txt found (HTTP ${res.status})`,
      };
    }

    const text = await res.text();

    if (!text.trim()) {
      return {
        score: 3,
        maxScore,
        label,
        detail: "/agents.txt exists but is empty",
      };
    }

    // Check for valid agents.txt format (key: value pairs, sections, etc.)
    const lines = text.trim().split("\n").filter(Boolean);
    const hasKeyValue = lines.some((line) => line.includes(":"));
    const hasComment = lines.some((line) => line.startsWith("#"));

    if (hasKeyValue && lines.length >= 2) {
      return {
        score: 10,
        maxScore,
        label,
        detail: `/agents.txt found with valid format (${lines.length} lines)`,
      };
    }

    if (hasKeyValue || hasComment) {
      return {
        score: 6,
        maxScore,
        label,
        detail: "/agents.txt found but format could be improved",
      };
    }

    return {
      score: 4,
      maxScore,
      label,
      detail: "/agents.txt found but doesn't follow standard format",
    };
  } catch {
    return {
      score: 0,
      maxScore,
      label,
      detail: "Failed to fetch /agents.txt",
    };
  }
}
