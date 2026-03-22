export interface CheckResult {
  score: number;
  maxScore: number;
  label: string;
  detail: string;
}

export type Check = (baseUrl: string) => Promise<CheckResult>;

export { checkStructuredErrors } from "./errors.js";
export { checkDiscovery } from "./discovery.js";
export { checkLlmsTxt } from "./llms-txt.js";
export { checkAgentsTxt } from "./agents-txt.js";
export { checkRateLimit } from "./rate-limit.js";
export { checkOpenAPI } from "./openapi.js";
export { checkMCP } from "./mcp.js";
export { checkAuth } from "./auth.js";
