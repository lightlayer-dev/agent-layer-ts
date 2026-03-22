import type { CheckResult } from "./index.js";

/**
 * Auth Discovery (10 pts)
 * Check /.well-known/oauth-authorization-server or auth info in discovery
 */
export async function checkAuth(baseUrl: string): Promise<CheckResult> {
  const maxScore = 10;
  const label = "Auth discovery";

  const paths = [
    "/.well-known/oauth-authorization-server",
    "/.well-known/openid-configuration",
  ];

  for (const path of paths) {
    try {
      const res = await fetch(`${baseUrl}${path}`);

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("json")) {
        const body = await res.json();

        // Check for standard OAuth fields
        const hasIssuer = "issuer" in body;
        const hasAuthEndpoint = "authorization_endpoint" in body;
        const hasTokenEndpoint = "token_endpoint" in body;

        if (hasIssuer && (hasAuthEndpoint || hasTokenEndpoint)) {
          return {
            score: 10,
            maxScore,
            label,
            detail: `Full auth discovery at ${path}`,
          };
        }

        return {
          score: 6,
          maxScore,
          label,
          detail: `Auth discovery at ${path} but missing key fields`,
        };
      }

      return {
        score: 4,
        maxScore,
        label,
        detail: `Found ${path} but not JSON`,
      };
    } catch {
      // Try next path
    }
  }

  // Also check if the main discovery endpoint has auth info
  try {
    const res = await fetch(`${baseUrl}/.well-known/ai`);

    if (res.ok) {
      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("json")) {
        const body = await res.json();

        if (body.auth || body.authentication || body.oauth) {
          return {
            score: 7,
            maxScore,
            label,
            detail: "Auth info found in discovery endpoint",
          };
        }
      }
    }
  } catch {
    // Ignore
  }

  return {
    score: 0,
    maxScore,
    label,
    detail: "No auth discovery found",
  };
}
