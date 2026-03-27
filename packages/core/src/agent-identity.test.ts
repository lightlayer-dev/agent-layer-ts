import { describe, it, expect } from "vitest";
import {
  parseSpiffeId,
  isSpiffeTrusted,
  decodeJwtClaims,
  extractClaims,
  validateClaims,
  evaluateAuthz,
  buildAuditEvent,
} from "./agent-identity.js";
import type {
  AgentIdentityConfig,
  AgentIdentityClaims,
  AgentAuthzPolicy,
  AuthzContext,
} from "./agent-identity.js";

// ── SPIFFE ID Parsing ────────────────────────────────────────────────────

describe("parseSpiffeId", () => {
  it("parses a valid SPIFFE ID with path", () => {
    const id = parseSpiffeId("spiffe://example.com/agent/weather-bot");
    expect(id).toEqual({
      trustDomain: "example.com",
      path: "/agent/weather-bot",
      raw: "spiffe://example.com/agent/weather-bot",
    });
  });

  it("parses a SPIFFE ID without path", () => {
    const id = parseSpiffeId("spiffe://example.com");
    expect(id).toEqual({
      trustDomain: "example.com",
      path: "/",
      raw: "spiffe://example.com",
    });
  });

  it("returns null for non-SPIFFE URIs", () => {
    expect(parseSpiffeId("https://example.com")).toBeNull();
    expect(parseSpiffeId("not-a-uri")).toBeNull();
    expect(parseSpiffeId("")).toBeNull();
  });
});

describe("isSpiffeTrusted", () => {
  it("trusts known domains", () => {
    const id = parseSpiffeId("spiffe://prod.example.com/bot")!;
    expect(isSpiffeTrusted(id, ["prod.example.com", "staging.example.com"])).toBe(true);
  });

  it("rejects unknown domains", () => {
    const id = parseSpiffeId("spiffe://evil.com/bot")!;
    expect(isSpiffeTrusted(id, ["prod.example.com"])).toBe(false);
  });
});

// ── JWT Decoding ─────────────────────────────────────────────────────────

describe("decodeJwtClaims", () => {
  it("decodes a valid JWT payload", () => {
    // Create a minimal JWT: header.payload.signature
    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ iss: "https://auth.example.com", sub: "agent-1" }),
    ).toString("base64url");
    const token = `${header}.${payload}.fakesig`;

    const claims = decodeJwtClaims(token);
    expect(claims).toEqual({ iss: "https://auth.example.com", sub: "agent-1" });
  });

  it("returns null for invalid tokens", () => {
    expect(decodeJwtClaims("not-a-jwt")).toBeNull();
    expect(decodeJwtClaims("a.b")).toBeNull();
    expect(decodeJwtClaims("")).toBeNull();
  });
});

// ── Claims Extraction ────────────────────────────────────────────────────

describe("extractClaims", () => {
  it("extracts standard claims", () => {
    const claims = extractClaims({
      iss: "https://auth.example.com",
      sub: "spiffe://example.com/agent/bot",
      aud: "https://api.example.com",
      exp: 1700000000,
      iat: 1699999000,
      scope: "read:data write:data",
    });

    expect(claims.agentId).toBe("spiffe://example.com/agent/bot");
    expect(claims.spiffeId?.trustDomain).toBe("example.com");
    expect(claims.issuer).toBe("https://auth.example.com");
    expect(claims.audience).toEqual(["https://api.example.com"]);
    expect(claims.scopes).toEqual(["read:data", "write:data"]);
    expect(claims.delegated).toBe(false);
  });

  it("extracts delegation info from act claim", () => {
    const claims = extractClaims({
      iss: "https://auth.example.com",
      sub: "agent-1",
      aud: ["https://api.example.com"],
      exp: 1700000000,
      iat: 1699999000,
      act: { sub: "user@example.com" },
    });

    expect(claims.delegated).toBe(true);
    expect(claims.delegatedBy).toBe("user@example.com");
  });

  it("supports array-based scopes (scp)", () => {
    const claims = extractClaims({
      iss: "test",
      sub: "agent",
      scp: ["read", "write"],
    });
    expect(claims.scopes).toEqual(["read", "write"]);
  });

  it("preserves custom claims", () => {
    const claims = extractClaims({
      iss: "test",
      sub: "agent",
      model: "gpt-4",
      provider: "openai",
    });
    expect(claims.customClaims).toEqual({ model: "gpt-4", provider: "openai" });
  });

  it("uses agent_id over sub when present", () => {
    const claims = extractClaims({
      iss: "test",
      sub: "service-account-123",
      agent_id: "spiffe://example.com/my-agent",
    });
    expect(claims.agentId).toBe("spiffe://example.com/my-agent");
    expect(claims.spiffeId?.trustDomain).toBe("example.com");
  });
});

// ── Claims Validation ────────────────────────────────────────────────────

describe("validateClaims", () => {
  const baseConfig: AgentIdentityConfig = {
    trustedIssuers: ["https://auth.example.com"],
    audience: ["https://api.example.com"],
  };

  const validClaims: AgentIdentityClaims = {
    agentId: "agent-1",
    issuer: "https://auth.example.com",
    subject: "agent-1",
    audience: ["https://api.example.com"],
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    issuedAt: Math.floor(Date.now() / 1000) - 10,
    scopes: ["read"],
    delegated: false,
    customClaims: {},
  };

  it("accepts valid claims", () => {
    expect(validateClaims(validClaims, baseConfig)).toBeNull();
  });

  it("rejects untrusted issuer", () => {
    const err = validateClaims({ ...validClaims, issuer: "https://evil.com" }, baseConfig);
    expect(err?.code).toBe("untrusted_issuer");
  });

  it("rejects invalid audience", () => {
    const err = validateClaims(
      { ...validClaims, audience: ["https://other.com"] },
      baseConfig,
    );
    expect(err?.code).toBe("invalid_audience");
  });

  it("rejects expired tokens", () => {
    const err = validateClaims(
      { ...validClaims, expiresAt: Math.floor(Date.now() / 1000) - 600 },
      baseConfig,
    );
    expect(err?.code).toBe("expired_token");
  });

  it("rejects tokens with excessive lifetime", () => {
    const now = Math.floor(Date.now() / 1000);
    const err = validateClaims(
      { ...validClaims, issuedAt: now, expiresAt: now + 7200 },
      { ...baseConfig, maxLifetimeSeconds: 3600 },
    );
    expect(err?.code).toBe("token_too_long_lived");
  });

  it("rejects untrusted SPIFFE domains", () => {
    const spiffeClaims: AgentIdentityClaims = {
      ...validClaims,
      agentId: "spiffe://evil.com/bot",
      spiffeId: { trustDomain: "evil.com", path: "/bot", raw: "spiffe://evil.com/bot" },
    };
    const err = validateClaims(spiffeClaims, {
      ...baseConfig,
      trustedDomains: ["example.com"],
    });
    expect(err?.code).toBe("untrusted_domain");
  });

  it("allows clock skew within tolerance", () => {
    const err = validateClaims(
      { ...validClaims, expiresAt: Math.floor(Date.now() / 1000) - 10 },
      { ...baseConfig, clockSkewSeconds: 30 },
    );
    expect(err).toBeNull();
  });
});

// ── Authorization ────────────────────────────────────────────────────────

describe("evaluateAuthz", () => {
  const claims: AgentIdentityClaims = {
    agentId: "spiffe://example.com/agent/weather-bot",
    spiffeId: {
      trustDomain: "example.com",
      path: "/agent/weather-bot",
      raw: "spiffe://example.com/agent/weather-bot",
    },
    issuer: "https://auth.example.com",
    subject: "weather-bot",
    audience: ["https://api.example.com"],
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    issuedAt: Math.floor(Date.now() / 1000),
    scopes: ["read:weather", "read:location"],
    delegated: false,
    customClaims: {},
  };

  const ctx: AuthzContext = {
    method: "GET",
    path: "/api/weather/forecast",
    headers: {},
  };

  it("allows when policy matches", () => {
    const policies: AgentAuthzPolicy[] = [
      {
        name: "weather-read",
        paths: ["/api/weather/*"],
        methods: ["GET"],
        requiredScopes: ["read:weather"],
      },
    ];
    const result = evaluateAuthz(claims, ctx, policies);
    expect(result.allowed).toBe(true);
    expect(result.matchedPolicy).toBe("weather-read");
  });

  it("denies when scopes are missing", () => {
    const policies: AgentAuthzPolicy[] = [
      {
        name: "weather-write",
        paths: ["/api/weather/*"],
        requiredScopes: ["write:weather"],
      },
    ];
    const result = evaluateAuthz(claims, ctx, policies);
    expect(result.allowed).toBe(false);
    expect(result.deniedReason).toContain("write:weather");
  });

  it("denies delegated access when disallowed", () => {
    const delegatedClaims = { ...claims, delegated: true, delegatedBy: "user@test.com" };
    const policies: AgentAuthzPolicy[] = [
      { name: "no-delegation", paths: ["/api/*"], allowDelegated: false },
    ];
    const result = evaluateAuthz(delegatedClaims, ctx, policies);
    expect(result.allowed).toBe(false);
    expect(result.deniedReason).toContain("Delegated");
  });

  it("uses default deny when no policy matches", () => {
    const result = evaluateAuthz(claims, ctx, [], "deny");
    expect(result.allowed).toBe(false);
  });

  it("uses default allow when configured", () => {
    const result = evaluateAuthz(claims, ctx, [], "allow");
    expect(result.allowed).toBe(true);
  });

  it("filters by trust domain", () => {
    const policies: AgentAuthzPolicy[] = [
      { name: "internal-only", trustDomains: ["internal.example.com"] },
    ];
    const result = evaluateAuthz(claims, ctx, policies, "deny");
    expect(result.allowed).toBe(false);
  });

  it("filters by agent pattern", () => {
    const policies: AgentAuthzPolicy[] = [
      { name: "weather-agents", agentPattern: "spiffe://example.com/agent/weather-*" },
    ];
    const result = evaluateAuthz(claims, ctx, policies);
    expect(result.allowed).toBe(true);
  });

  it("supports custom evaluator", () => {
    const policies: AgentAuthzPolicy[] = [
      {
        name: "custom",
        evaluate: (c) => c.scopes.includes("admin"),
      },
    ];
    const result = evaluateAuthz(claims, ctx, policies);
    expect(result.allowed).toBe(false);
  });
});

// ── Audit Event ──────────────────────────────────────────────────────────

describe("buildAuditEvent", () => {
  it("builds a complete audit event", () => {
    const claims: AgentIdentityClaims = {
      agentId: "spiffe://example.com/bot",
      spiffeId: { trustDomain: "example.com", path: "/bot", raw: "spiffe://example.com/bot" },
      issuer: "https://auth.example.com",
      subject: "bot",
      audience: ["https://api.example.com"],
      expiresAt: 1700000000,
      issuedAt: 1699999000,
      scopes: ["read"],
      delegated: true,
      delegatedBy: "user@example.com",
      customClaims: {},
    };

    const event = buildAuditEvent(
      claims,
      { method: "GET", path: "/data", headers: {} },
      { allowed: true, matchedPolicy: "default" },
    );

    expect(event.type).toBe("agent_identity");
    expect(event.agentId).toBe("spiffe://example.com/bot");
    expect(event.spiffeId).toBe("spiffe://example.com/bot");
    expect(event.delegated).toBe(true);
    expect(event.delegatedBy).toBe("user@example.com");
    expect(event.authzResult.allowed).toBe(true);
    expect(event.timestamp).toBeTruthy();
  });
});
