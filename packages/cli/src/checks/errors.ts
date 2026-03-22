import type { CheckResult } from "./index.js";

/**
 * Structured Errors (15 pts)
 * Request a non-existent path, check if response is JSON with error envelope
 */
export async function checkStructuredErrors(
  baseUrl: string,
): Promise<CheckResult> {
  const maxScore = 15;
  const label = "Structured JSON errors";

  try {
    const res = await fetch(
      `${baseUrl}/__agent_layer_nonexistent_path_${Date.now()}`,
    );
    const contentType = res.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return {
        score: 0,
        maxScore,
        label,
        detail: `Non-existent path returned ${contentType || "no content-type"} instead of JSON`,
      };
    }

    const body = await res.json();

    // Check for error envelope structure
    const hasErrorField =
      "error" in body || "message" in body || "errors" in body;
    const hasStatusCode =
      "status" in body || "statusCode" in body || "code" in body;

    if (hasErrorField && hasStatusCode) {
      return {
        score: 15,
        maxScore,
        label,
        detail: "Returns structured JSON errors with error envelope",
      };
    }

    if (hasErrorField || hasStatusCode) {
      return {
        score: 10,
        maxScore,
        label,
        detail: "Returns JSON errors but envelope is incomplete",
      };
    }

    return {
      score: 5,
      maxScore,
      label,
      detail: "Returns JSON but no standard error envelope",
    };
  } catch {
    return {
      score: 0,
      maxScore,
      label,
      detail: "Failed to connect or parse response",
    };
  }
}
