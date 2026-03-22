/**
 * All agent-readiness checks.
 */

export { checkStructuredErrors } from "./structured-errors.js";
export { checkDiscovery } from "./discovery.js";
export { checkLlmsTxt } from "./llms-txt.js";
export { checkRobotsTxt } from "./robots-txt.js";
export { checkRateLimits } from "./rate-limits.js";
export { checkOpenApi } from "./openapi.js";
export { checkContentType } from "./content-type.js";
export { checkCors } from "./cors.js";
export { checkSecurityHeaders } from "./security-headers.js";
export { checkResponseTime } from "./response-time.js";
export { checkX402 } from "./x402.js";

import type { CheckFn } from "../types.js";
import { checkStructuredErrors } from "./structured-errors.js";
import { checkDiscovery } from "./discovery.js";
import { checkLlmsTxt } from "./llms-txt.js";
import { checkRobotsTxt } from "./robots-txt.js";
import { checkRateLimits } from "./rate-limits.js";
import { checkOpenApi } from "./openapi.js";
import { checkContentType } from "./content-type.js";
import { checkCors } from "./cors.js";
import { checkSecurityHeaders } from "./security-headers.js";
import { checkResponseTime } from "./response-time.js";
import { checkX402 } from "./x402.js";

/** All checks in execution order. */
export const allChecks: CheckFn[] = [
  checkStructuredErrors,
  checkDiscovery,
  checkLlmsTxt,
  checkRobotsTxt,
  checkRateLimits,
  checkOpenApi,
  checkContentType,
  checkCors,
  checkSecurityHeaders,
  checkResponseTime,
  checkX402,
];
