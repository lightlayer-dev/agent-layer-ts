/**
 * Shared test utilities for agent-layer packages.
 *
 * Provides mock JWT builders, common config fixtures, and test helpers
 * shared across Express, Koa, Hono, and Fastify test suites.
 */

import type { AgentIdentityConfig, AgentIdentityClaims } from "./agent-identity.js";
import type { RouteMetadata } from "./types.js";
import type { McpServerConfig } from "./mcp.js";

// ── Mock JWT Builder ────────────────────────────────────────────────────

/**
 * Create a mock JWT token (unsigned) with the given payload.
 * Suitable for testing — NOT for production.
 */
export function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.nosig`;
}

// ── Common Fixtures ─────────────────────────────────────────────────────

const now = Math.floor(Date.now() / 1000);

export const validJwtPayload = {
  iss: "https://auth.example.com",
  sub: "spiffe://example.com/agent/test-bot",
  aud: "https://api.example.com",
  exp: now + 600,
  iat: now,
  scope: "read:data write:data",
};

export const baseIdentityConfig: AgentIdentityConfig = {
  trustedIssuers: ["https://auth.example.com"],
  audience: ["https://api.example.com"],
};

export const testRoutes: RouteMetadata[] = [
  {
    method: "GET",
    path: "/api/users",
    summary: "List all users",
    parameters: [
      { name: "limit", in: "query", description: "Max results" },
    ],
  },
  {
    method: "POST",
    path: "/api/users",
    summary: "Create a user",
    parameters: [
      { name: "name", in: "body", required: true },
      { name: "email", in: "body", required: true },
    ],
  },
  {
    method: "GET",
    path: "/api/users/:id",
    summary: "Get user by ID",
    parameters: [{ name: "id", in: "path", required: true }],
  },
];

export const testMcpConfig: McpServerConfig = {
  name: "test-api",
  version: "1.0.0",
  instructions: "Use these tools to manage users",
  routes: testRoutes,
};

export function makeCustomVerifier(
  claims: Partial<AgentIdentityClaims> | null,
): AgentIdentityConfig["verifyToken"] {
  return async () => {
    if (!claims) return null;
    return {
      agentId: claims.agentId ?? "custom-agent",
      issuer: claims.issuer ?? "https://auth.example.com",
      subject: claims.subject ?? "custom-agent",
      audience: claims.audience ?? ["https://api.example.com"],
      expiresAt: claims.expiresAt ?? now + 600,
      issuedAt: claims.issuedAt ?? now,
      scopes: claims.scopes ?? ["all"],
      delegated: claims.delegated ?? false,
      customClaims: claims.customClaims ?? {},
    };
  };
}
