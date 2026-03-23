/**
 * Check: AG-UI (Agent-UI) streaming support.
 * Checks for AG-UI endpoint presence via common conventions.
 */

import type { CheckResult, ScanConfig } from "../types.js";
import { safeFetch, resolveUrl } from "./utils.js";

const AG_UI_PATHS = [
  "/ag-ui",
  "/api/ag-ui",
  "/.well-known/ag-ui",
];

export async function checkAgUi(config: ScanConfig): Promise<CheckResult> {
  const base: CheckResult = {
    id: "ag-ui",
    name: "AG-UI Streaming",
    score: 0,
    maxScore: 5,
    severity: "fail",
    message: "",
  };

  const found: string[] = [];
  const details: Record<string, unknown> = {};

  for (const path of AG_UI_PATHS) {
    const url = resolveUrl(config.url, path);
    const res = await safeFetch(url, config);
    const status = res?.status ?? 0;
    // AG-UI endpoints typically return 200 or 405 (method not allowed for GET on a POST endpoint)
    const ok = status >= 200 && status < 400 || status === 405;

    details[path] = { status, found: ok };

    if (ok) {
      found.push(path);
    }
  }

  if (found.length > 0) {
    return {
      ...base,
      score: 5,
      severity: "pass",
      message: `AG-UI endpoint found at ${found.join(", ")}`,
      details,
    };
  }

  return {
    ...base,
    message: "No AG-UI streaming endpoint detected",
    suggestion:
      "Add AG-UI streaming support for real-time agent communication. Use @agent-layer ag-ui middleware for Express/Fastify/Hono/Koa.",
    details,
  };
}
