import type { CheckResult } from "./index.js";

/**
 * Discovery Endpoint (15 pts)
 * Check /.well-known/ai OR /.well-known/agent.json exists
 */
export async function checkDiscovery(baseUrl: string): Promise<CheckResult> {
  const maxScore = 15;
  const label = "Discovery endpoint";

  const paths = ["/.well-known/ai", "/.well-known/agent.json"];

  for (const path of paths) {
    try {
      const res = await fetch(`${baseUrl}${path}`);

      if (res.ok) {
        const contentType = res.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
          return {
            score: 15,
            maxScore,
            label,
            detail: `Found ${path} with JSON response`,
          };
        }

        return {
          score: 10,
          maxScore,
          label,
          detail: `Found ${path} but not JSON (${contentType})`,
        };
      }
    } catch {
      // Try next path
    }
  }

  return {
    score: 0,
    maxScore,
    label,
    detail: "No discovery endpoint found at /.well-known/ai or /.well-known/agent.json",
  };
}
