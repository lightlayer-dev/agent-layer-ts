import { describe, it, expect } from "vitest";
import { generateUnifiedDiscovery } from "./unified-discovery.js";
import type { UnifiedDiscoveryConfig } from "./unified-discovery.js";

const fullConfig: UnifiedDiscoveryConfig = {
  name: "Widget API",
  description: "REST API for managing widgets",
  version: "2.0.0",
  url: "https://api.widgets.com",
  provider: { organization: "Widgets Inc.", url: "https://widgets.com" },
  contact: { email: "dev@widgets.com", url: "https://widgets.com" },
  openapiUrl: "https://api.widgets.com/openapi.json",
  auth: {
    type: "oauth2",
    authorizationUrl: "https://auth.widgets.com/authorize",
    tokenUrl: "https://auth.widgets.com/token",
    scopes: { read: "Read widgets", write: "Create/update widgets" },
  },
  skills: [
    {
      id: "search",
      name: "Search Widgets",
      description: "Full-text search across all widgets",
      tags: ["search", "query"],
      examples: ["find red widgets", "search for large widgets"],
    },
    {
      id: "crud",
      name: "Widget CRUD",
      description: "Create, read, update, delete widgets",
    },
  ],
  agentRules: [
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
    },
  ],
  llmsSections: [
    { title: "Authentication", content: "Use OAuth2 Bearer tokens." },
  ],
  routes: [
    {
      method: "GET",
      path: "/api/widgets",
      summary: "List all widgets",
      parameters: [{ name: "limit", in: "query", description: "Max results" }],
    },
  ],
};

describe("generateUnifiedDiscovery", () => {
  it("generates all formats by default", () => {
    const output = generateUnifiedDiscovery(fullConfig);

    expect(output.wellKnownAi).toBeDefined();
    expect(output.agentCard).toBeDefined();
    expect(output.agentsTxt).toBeDefined();
    expect(output.llmsTxt).toBeDefined();
    expect(output.llmsFullTxt).toBeDefined();
    expect(output.jsonLd).toBeDefined();
  });

  describe("/.well-known/ai", () => {
    it("includes name, description, and auth", () => {
      const output = generateUnifiedDiscovery(fullConfig);
      const manifest = output.wellKnownAi!;

      expect(manifest.name).toBe("Widget API");
      expect(manifest.description).toBe("REST API for managing widgets");
      expect(manifest.auth?.type).toBe("oauth2");
      expect(manifest.auth?.token_url).toBe("https://auth.widgets.com/token");
    });

    it("maps skills to capabilities", () => {
      const output = generateUnifiedDiscovery(fullConfig);
      expect(output.wellKnownAi!.capabilities).toEqual(["Search Widgets", "Widget CRUD"]);
    });

    it("includes llms.txt URL hint", () => {
      const output = generateUnifiedDiscovery(fullConfig);
      expect(output.wellKnownAi!.llms_txt_url).toBe("/llms.txt");
    });
  });

  describe("/.well-known/agent.json (A2A)", () => {
    it("generates valid A2A Agent Card", () => {
      const output = generateUnifiedDiscovery(fullConfig);
      const card = output.agentCard!;

      expect(card.protocolVersion).toBe("1.0.0");
      expect(card.name).toBe("Widget API");
      expect(card.url).toBe("https://api.widgets.com");
      expect(card.provider?.organization).toBe("Widgets Inc.");
    });

    it("maps skills to A2A skills", () => {
      const output = generateUnifiedDiscovery(fullConfig);
      const skills = output.agentCard!.skills;

      expect(skills).toHaveLength(2);
      expect(skills[0].id).toBe("search");
      expect(skills[0].name).toBe("Search Widgets");
      expect(skills[0].tags).toEqual(["search", "query"]);
    });

    it("maps auth to A2A authentication scheme", () => {
      const output = generateUnifiedDiscovery(fullConfig);
      const auth = output.agentCard!.authentication!;

      expect(auth.type).toBe("oauth2");
      expect(auth.tokenUrl).toBe("https://auth.widgets.com/token");
      expect(auth.scopes).toEqual({ read: "Read widgets", write: "Create/update widgets" });
    });

    it("includes default input/output modes on skills", () => {
      const output = generateUnifiedDiscovery(fullConfig);
      const skill = output.agentCard!.skills[0];

      expect(skill.inputModes).toEqual(["text/plain"]);
      expect(skill.outputModes).toEqual(["text/plain", "application/json"]);
    });
  });

  describe("/agents.txt", () => {
    it("generates agents.txt with rules", () => {
      const output = generateUnifiedDiscovery(fullConfig);
      const txt = output.agentsTxt!;

      expect(txt).toContain("User-agent: *");
      expect(txt).toContain("Allow: /api/public/*");
      expect(txt).toContain("Deny: /api/admin/*");
      expect(txt).toContain("Rate-limit: 100/60s");
      expect(txt).toContain("User-agent: GPT-*");
      expect(txt).toContain("Preferred-interface: mcp");
    });

    it("includes site metadata", () => {
      const output = generateUnifiedDiscovery(fullConfig);
      const txt = output.agentsTxt!;

      expect(txt).toContain("# Site: Widget API");
      expect(txt).toContain("# Contact: dev@widgets.com");
      expect(txt).toContain("# Discovery: /.well-known/ai");
    });

    it("adds default permissive rule when no rules provided", () => {
      const output = generateUnifiedDiscovery({
        name: "Simple API",
      });

      expect(output.agentsTxt).toContain("User-agent: *");
    });
  });

  describe("/llms.txt", () => {
    it("generates llms.txt with title and description", () => {
      const output = generateUnifiedDiscovery(fullConfig);

      expect(output.llmsTxt).toContain("# Widget API");
      expect(output.llmsTxt).toContain("> REST API for managing widgets");
    });

    it("includes custom sections", () => {
      const output = generateUnifiedDiscovery(fullConfig);

      expect(output.llmsTxt).toContain("## Authentication");
      expect(output.llmsTxt).toContain("Use OAuth2 Bearer tokens.");
    });

    it("generates llms-full.txt with route details", () => {
      const output = generateUnifiedDiscovery(fullConfig);

      expect(output.llmsFullTxt).toContain("GET /api/widgets");
      expect(output.llmsFullTxt).toContain("List all widgets");
    });
  });

  describe("JSON-LD", () => {
    it("generates valid JSON-LD structure", () => {
      const output = generateUnifiedDiscovery(fullConfig);
      const ld = output.jsonLd!;

      expect(ld["@context"]).toBe("https://schema.org");
      expect(ld["@type"]).toBe("WebAPI");
      expect(ld["name"]).toBe("Widget API");
    });

    it("includes contact and documentation", () => {
      const output = generateUnifiedDiscovery(fullConfig);
      const ld = output.jsonLd!;

      expect(ld["documentation"]).toBe("https://api.widgets.com/openapi.json");
      expect(ld["contactPoint"]).toEqual({
        "@type": "ContactPoint",
        email: "dev@widgets.com",
      });
    });
  });

  describe("format control", () => {
    it("can disable specific formats", () => {
      const output = generateUnifiedDiscovery({
        name: "API",
        formats: {
          wellKnownAi: true,
          agentCard: false,
          agentsTxt: false,
          llmsTxt: false,
          jsonLd: false,
        },
      });

      expect(output.wellKnownAi).toBeDefined();
      expect(output.agentCard).toBeUndefined();
      expect(output.agentsTxt).toBeUndefined();
      expect(output.llmsTxt).toBeUndefined();
      expect(output.jsonLd).toBeUndefined();
    });

    it("can enable only agents.txt", () => {
      const output = generateUnifiedDiscovery({
        name: "API",
        formats: {
          wellKnownAi: false,
          agentCard: false,
          agentsTxt: true,
          llmsTxt: false,
          jsonLd: false,
        },
      });

      expect(output.agentsTxt).toContain("User-agent: *");
      expect(output.wellKnownAi).toBeUndefined();
    });
  });

  describe("minimal config", () => {
    it("works with just a name", () => {
      const output = generateUnifiedDiscovery({ name: "Simple API" });

      expect(output.wellKnownAi?.name).toBe("Simple API");
      expect(output.agentCard?.name).toBe("Simple API");
      expect(output.agentsTxt).toContain("# Site: Simple API");
      expect(output.llmsTxt).toContain("# Simple API");
    });
  });

  describe("API key auth", () => {
    it("maps api_key auth to A2A scheme", () => {
      const output = generateUnifiedDiscovery({
        name: "API",
        auth: { type: "api_key" },
      });

      const auth = output.agentCard!.authentication!;
      expect(auth.type).toBe("api_key");
      expect(auth.in).toBe("header");
      expect(auth.name).toBe("X-Agent-Key");
    });

    it("maps bearer auth to A2A scheme", () => {
      const output = generateUnifiedDiscovery({
        name: "API",
        auth: { type: "bearer" },
      });

      const auth = output.agentCard!.authentication!;
      expect(auth.type).toBe("bearer");
      expect(auth.in).toBe("header");
      expect(auth.name).toBe("Authorization");
    });
  });
});
