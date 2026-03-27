/**
 * Check: OpenAPI / Swagger specification availability.
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch, resolveUrl } from "./utils.js";

const OPENAPI_PATHS = [
  "/openapi.json",
  "/openapi.yaml",
  "/swagger.json",
  "/api-docs",
  "/docs/openapi.json",
  "/v1/openapi.json",
  "/api/openapi.json",
  "/.well-known/openapi.json",
];

export async function checkOpenApi(
  config: ScanConfig,
): Promise<CheckResult> {
  const base: CheckResult = {
    id: "openapi",
    name: "OpenAPI / Swagger Spec",
    score: 0,
    maxScore: 10,
    severity: "fail",
    message: "",
  };

  const found: { path: string; hasDescriptions: boolean; version?: string }[] = [];
  const details: Record<string, unknown> = {};

  for (const path of OPENAPI_PATHS) {
    const url = resolveUrl(config.url, path);
    const res = await safeFetch(url, config);

    if (!res || res.status >= 400) {
      details[path] = { status: res?.status ?? 0 };
      continue;
    }

    const ct = res.headers.get("content-type") ?? "";
    const isJsonOrYaml =
      ct.includes("json") || ct.includes("yaml") || ct.includes("text");

    if (!isJsonOrYaml) {
      details[path] = { status: res.status, contentType: ct, skipped: true };
      continue;
    }

    try {
      const text = await res.text();
      let hasDescriptions = false;
      let version: string | undefined;

      // Try to parse as JSON for quality check
      try {
        const parsed = JSON.parse(text);
        version = parsed.openapi ?? parsed.swagger;
        // Check if paths have descriptions
        const paths = parsed.paths ?? {};
        const pathCount = Object.keys(paths).length;
        const withDesc = Object.values(paths).filter((p: any) => {
          return Object.values(p).some(
            (op: any) => op?.description || op?.summary,
          );
        }).length;
        hasDescriptions = pathCount > 0 && withDesc / pathCount > 0.5;
      } catch {
        // YAML or malformed — still counts as found
        hasDescriptions = text.includes("description:");
      }

      found.push({ path, hasDescriptions, version });
      details[path] = {
        status: res.status,
        found: true,
        version,
        hasDescriptions,
      };
    } catch {
      details[path] = { status: res.status, error: "Could not read body" };
    }
  }

  if (found.length === 0) {
    return {
      ...base,
      message: "No OpenAPI or Swagger spec found",
      suggestion:
        "Serve an OpenAPI spec at /openapi.json so agents can discover your API structure",
      details,
    };
  }

  const best = found[0];
  let score = 5;

  if (best.version?.startsWith("3")) score += 2;
  else if (best.version) score += 1;

  if (best.hasDescriptions) score += 3;
  else score += 1;

  score = Math.min(score, 10);

  const notes = [`Found at ${best.path}`];
  if (best.version) notes.push(`version ${best.version}`);
  if (best.hasDescriptions) notes.push("with good descriptions");
  else notes.push("descriptions could be more detailed");

  return {
    ...base,
    score,
    severity: score >= 8 ? "pass" : "warn",
    message: notes.join("; "),
    suggestion:
      score < 10
        ? "Ensure all endpoints have descriptions and summaries for better agent comprehension"
        : undefined,
    details,
  };
}
