import { describe, it, expect } from "vitest";
import {
  generateAgentsTxt,
  parseAgentsTxt,
  isAgentAllowed,
} from "./agents-txt.js";
import type { AgentsTxtConfig } from "./agents-txt.js";

describe("generateAgentsTxt", () => {
  it("generates minimal agents.txt with a single wildcard rule", () => {
    const txt = generateAgentsTxt({
      rules: [{ agent: "*", allow: ["/api/*"] }],
    });

    expect(txt).toContain("# agents.txt — AI Agent Access Policy");
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /api/*");
  });

  it("includes site metadata in header comments", () => {
    const txt = generateAgentsTxt({
      rules: [{ agent: "*" }],
      siteName: "My API",
      contact: "support@example.com",
      discoveryUrl: "https://example.com/.well-known/ai",
    });

    expect(txt).toContain("# Site: My API");
    expect(txt).toContain("# Contact: support@example.com");
    expect(txt).toContain("# Discovery: https://example.com/.well-known/ai");
  });

  it("generates multiple rule blocks", () => {
    const txt = generateAgentsTxt({
      rules: [
        {
          agent: "*",
          allow: ["/api/public/*"],
          deny: ["/api/admin/*"],
          rateLimit: { max: 100, windowSeconds: 60 },
        },
        {
          agent: "GPT-*",
          allow: ["/api/*"],
          preferredInterface: "mcp",
          auth: { type: "bearer", endpoint: "https://example.com/oauth/token" },
        },
      ],
    });

    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /api/public/*");
    expect(txt).toContain("Deny: /api/admin/*");
    expect(txt).toContain("Rate-limit: 100/60s");
    expect(txt).toContain("User-agent: GPT-*");
    expect(txt).toContain("Allow: /api/*");
    expect(txt).toContain("Preferred-interface: mcp");
    expect(txt).toContain("Auth: bearer https://example.com/oauth/token");
  });

  it("uses default 60s window for rate limits", () => {
    const txt = generateAgentsTxt({
      rules: [{ agent: "*", rateLimit: { max: 50 } }],
    });

    expect(txt).toContain("Rate-limit: 50/60s");
  });

  it("includes auth-docs when provided", () => {
    const txt = generateAgentsTxt({
      rules: [
        {
          agent: "*",
          auth: {
            type: "oauth2",
            endpoint: "https://example.com/oauth/token",
            docsUrl: "https://docs.example.com/auth",
          },
        },
      ],
    });

    expect(txt).toContain("Auth: oauth2 https://example.com/oauth/token");
    expect(txt).toContain("Auth-docs: https://docs.example.com/auth");
  });

  it("includes description as inline comment", () => {
    const txt = generateAgentsTxt({
      rules: [
        {
          agent: "ClaudeBot",
          description: "Full access for Claude agents",
          allow: ["/*"],
        },
      ],
    });

    expect(txt).toContain("User-agent: ClaudeBot");
    expect(txt).toContain("# Full access for Claude agents");
    expect(txt).toContain("Allow: /*");
  });
});

describe("parseAgentsTxt", () => {
  it("round-trips a simple config", () => {
    const original: AgentsTxtConfig = {
      rules: [
        {
          agent: "*",
          allow: ["/api/public/*"],
          deny: ["/api/admin/*"],
        },
      ],
      siteName: "Test API",
      contact: "test@example.com",
    };

    const txt = generateAgentsTxt(original);
    const parsed = parseAgentsTxt(txt);

    expect(parsed.siteName).toBe("Test API");
    expect(parsed.contact).toBe("test@example.com");
    expect(parsed.rules).toHaveLength(1);
    expect(parsed.rules[0].agent).toBe("*");
    expect(parsed.rules[0].allow).toEqual(["/api/public/*"]);
    expect(parsed.rules[0].deny).toEqual(["/api/admin/*"]);
  });

  it("parses multiple rule blocks", () => {
    const txt = [
      "User-agent: *",
      "Allow: /api/*",
      "",
      "User-agent: GPT-*",
      "Allow: /api/*",
      "Rate-limit: 200/120s",
      "Preferred-interface: mcp",
    ].join("\n");

    const parsed = parseAgentsTxt(txt);

    expect(parsed.rules).toHaveLength(2);
    expect(parsed.rules[0].agent).toBe("*");
    expect(parsed.rules[1].agent).toBe("GPT-*");
    expect(parsed.rules[1].rateLimit).toEqual({ max: 200, windowSeconds: 120 });
    expect(parsed.rules[1].preferredInterface).toBe("mcp");
  });

  it("parses auth directives", () => {
    const txt = [
      "User-agent: *",
      "Auth: bearer https://example.com/token",
      "Auth-docs: https://docs.example.com/auth",
    ].join("\n");

    const parsed = parseAgentsTxt(txt);

    expect(parsed.rules[0].auth).toEqual({
      type: "bearer",
      endpoint: "https://example.com/token",
      docsUrl: "https://docs.example.com/auth",
    });
  });

  it("parses discovery URL from header", () => {
    const txt = [
      "# agents.txt — AI Agent Access Policy",
      "# Discovery: https://example.com/.well-known/ai",
      "",
      "User-agent: *",
      "Allow: /*",
    ].join("\n");

    const parsed = parseAgentsTxt(txt);
    expect(parsed.discoveryUrl).toBe("https://example.com/.well-known/ai");
  });

  it("handles empty/comment-only input", () => {
    const parsed = parseAgentsTxt("# Just a comment\n\n");
    expect(parsed.rules).toHaveLength(0);
  });
});

describe("isAgentAllowed", () => {
  const config: AgentsTxtConfig = {
    rules: [
      {
        agent: "*",
        allow: ["/api/public/*"],
        deny: ["/api/admin/*"],
      },
      {
        agent: "GPT-*",
        allow: ["/api/*"],
      },
      {
        agent: "TrustedBot",
        allow: ["/*"],
      },
    ],
  };

  it("allows wildcard agent on permitted paths", () => {
    expect(isAgentAllowed(config, "SomeBot", "/api/public/users")).toBe(true);
  });

  it("denies wildcard agent on denied paths", () => {
    expect(isAgentAllowed(config, "SomeBot", "/api/admin/settings")).toBe(false);
  });

  it("denies wildcard agent on paths not in allow list", () => {
    expect(isAgentAllowed(config, "SomeBot", "/api/private/data")).toBe(false);
  });

  it("prefers pattern match over wildcard", () => {
    // GPT-* rule allows all /api/*, even /api/admin/*
    expect(isAgentAllowed(config, "GPT-4o", "/api/admin/settings")).toBe(true);
  });

  it("prefers exact match over pattern", () => {
    expect(isAgentAllowed(config, "TrustedBot", "/api/admin/settings")).toBe(true);
    expect(isAgentAllowed(config, "TrustedBot", "/anything")).toBe(true);
  });

  it("returns undefined for unknown agent with no wildcard rule", () => {
    const noWildcard: AgentsTxtConfig = {
      rules: [{ agent: "SpecificBot", allow: ["/api/*"] }],
    };
    expect(isAgentAllowed(noWildcard, "UnknownBot", "/api/test")).toBe(undefined);
  });

  it("allows implicitly when rule has no allow/deny", () => {
    const permissive: AgentsTxtConfig = {
      rules: [{ agent: "*" }],
    };
    expect(isAgentAllowed(permissive, "AnyBot", "/anything")).toBe(true);
  });

  it("deny takes precedence over allow in same rule", () => {
    const strict: AgentsTxtConfig = {
      rules: [
        {
          agent: "*",
          allow: ["/api/*"],
          deny: ["/api/secret/*"],
        },
      ],
    };
    expect(isAgentAllowed(strict, "Bot", "/api/public")).toBe(true);
    expect(isAgentAllowed(strict, "Bot", "/api/secret/keys")).toBe(false);
  });
});
