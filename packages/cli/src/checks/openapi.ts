import type { CheckResult } from "./index.js";

/**
 * OpenAPI Spec (15 pts)
 * Check /openapi.json or /swagger.json exists
 */
export async function checkOpenAPI(baseUrl: string): Promise<CheckResult> {
  const maxScore = 15;
  const label = "OpenAPI spec";

  const paths = ["/openapi.json", "/swagger.json", "/openapi.yaml"];

  for (const path of paths) {
    try {
      const res = await fetch(`${baseUrl}${path}`);

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";
      const text = await res.text();

      let spec: Record<string, unknown> | null = null;

      if (
        contentType.includes("json") ||
        path.endsWith(".json")
      ) {
        try {
          spec = JSON.parse(text);
        } catch {
          // not valid JSON
        }
      }

      if (!spec) {
        return {
          score: 5,
          maxScore,
          label,
          detail: `Found ${path} but could not parse`,
        };
      }

      // Check quality of OpenAPI spec
      const hasInfo = "info" in spec;
      const hasPaths = "paths" in spec;
      const hasOpenApiVersion = "openapi" in spec || "swagger" in spec;

      if (hasInfo && hasPaths && hasOpenApiVersion) {
        // Check if paths have descriptions
        const pathsObj = spec.paths as Record<string, Record<string, unknown>> | undefined;
        if (pathsObj) {
          const pathCount = Object.keys(pathsObj).length;
          const describedOps = Object.values(pathsObj).reduce((count, methods) => {
            return count + Object.values(methods).filter(
              (op) => typeof op === "object" && op !== null && "description" in op,
            ).length;
          }, 0);

          if (pathCount > 0 && describedOps === 0) {
            return {
              score: 10,
              maxScore,
              label,
              detail: `OpenAPI spec found at ${path} but operations lack descriptions`,
            };
          }
        }

        return {
          score: 15,
          maxScore,
          label,
          detail: `Full OpenAPI spec found at ${path}`,
        };
      }

      return {
        score: 7,
        maxScore,
        label,
        detail: `OpenAPI spec found at ${path} but incomplete`,
      };
    } catch {
      // Try next path
    }
  }

  return {
    score: 0,
    maxScore,
    label,
    detail: "No OpenAPI spec found at /openapi.json, /swagger.json, or /openapi.yaml",
  };
}
