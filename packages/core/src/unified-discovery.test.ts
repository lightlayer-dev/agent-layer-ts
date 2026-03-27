import { describe, it, expect } from "vitest";
import {
  generateUnifiedAIManifest,
  generateUnifiedAgentCard,
  generateUnifiedLlmsTxt,
  generateUnifiedLlmsFullTxt,
  generateAgentsTxt,
  generateAllDiscovery,
  isFormatEnabled,
} from "./unified-discovery.js";
import type { UnifiedDiscoveryConfig } from "./unified-discovery.js";

const baseConfig: UnifiedDiscoveryConfig = {
  name: "Widget API",
  description: "REST API for widgets",
  url: "https://api.example.com",
  version: "2.0.0",
  provider: { organization: "Example Inc", url: "https://example.com" },
  contact: { email: "support@example.com", url: "https://example.com" },
  openApiUrl: "https://api.example.com/openapi.json",
  documentationUrl: "https://docs.example.com",
  capabilities: ["search", "crud"],
  auth: {
    type: "oauth2",
    authorizationUrl: "https://auth.example.com/authorize",
    tokenUrl: "https://auth.example.com/token",
    scopes: { read: "Read access", write: "Write access" },
  },
  skills: [
    {
      id: "search",
      name: "Search Widgets",
      description: "Full-text search across all widgets",
      tags: ["search", "query"],
      examples: ["Find red widgets", "Search for large widgets"],
      inputModes: ["text/plain"],
      outputModes: ["application/json"],
    },
    {
      id: "crud",
      name: "Widget CRUD",
      description: "Create, read, update, delete widgets",
      tags: ["crud"],
    },
  ],
  routes: [
    { method: "GET", path: "/api/widgets", summary: "List widgets" },
    {
      method: "POST",
      path: "/api/widgets",
      summary: "Create a widget",
      parameters: [
        { name: "name", in: "body", required: true, description: "Widget name" },
      ],
    },
  ],
};

describe("isFormatEnabled", () => {
  it("returns true when formats is undefined", () => {
    expect(isFormatEnabled(undefined, "wellKnownAi")).toBe(true);
  });

  it("returns true when format is not explicitly set", () => {
    expect(isFormatEnabled({}, "agentCard")).toBe(true);
  });

  it("returns false when format is explicitly false", () => {
    expect(isFormatEnabled({ agentsTxt: false }, "agentsTxt")).toBe(false);
  });

  it("returns true when format is explicitly true", () => {
    expect(isFormatEnabled({ llmsTxt: true }, "llmsTxt")).toBe(true);
  });
});

describe("generateUnifiedAIManifest", () => {
  it("generates a valid AI manifest", () => {
    const manifest = generateUnifiedAIManifest(baseConfig);
    expect(manifest.name).toBe("Widget API");
    expect(manifest.description).toBe("REST API for widgets");
    expect(manifest.openapi_url).toBe("https://api.example.com/openapi.json");
    expect(manifest.capabilities).toEqual(["search", "crud"]);
    expect(manifest.auth?.type).toBe("oauth2");
    expect(manifest.llms_txt_url).toBe("https://api.example.com/llms.txt");
  });

  it("omits llms_txt_url when llmsTxt format is disabled", () => {
    const config = { ...baseConfig, formats: { llmsTxt: false } };
    const manifest = generateUnifiedAIManifest(config);
    expect(manifest.llms_txt_url).toBeUndefined();
  });

  it("maps bearer auth to api_key for AI manifest", () => {
    const config = { ...baseConfig, auth: { type: "bearer" as const } };
    const manifest = generateUnifiedAIManifest(config);
    expect(manifest.auth?.type).toBe("api_key");
  });
});

describe("generateUnifiedAgentCard", () => {
  it("generates a valid A2A Agent Card", () => {
    const card = generateUnifiedAgentCard(baseConfig);
    expect(card.name).toBe("Widget API");
    expect(card.url).toBe("https://api.example.com");
    expect(card.protocolVersion).toBe("1.0.0");
    expect(card.version).toBe("2.0.0");
    expect(card.skills).toHaveLength(2);
    expect(card.skills[0].id).toBe("search");
    expect(card.skills[0].name).toBe("Search Widgets");
    expect(card.provider?.organization).toBe("Example Inc");
    expect(card.authentication?.type).toBe("oauth2");
  });

  it("maps api_key auth to apiKey for A2A", () => {
    const config = {
      ...baseConfig,
      auth: { type: "api_key" as const, in: "header" as const, name: "X-API-Key" },
    };
    const card = generateUnifiedAgentCard(config);
    expect(card.authentication?.type).toBe("apiKey");
    expect(card.authentication?.in).toBe("header");
    expect(card.authentication?.name).toBe("X-API-Key");
  });

  it("uses documentationUrl over openApiUrl", () => {
    const card = generateUnifiedAgentCard(baseConfig);
    expect(card.documentationUrl).toBe("https://docs.example.com");
  });

  it("falls back to openApiUrl when documentationUrl is absent", () => {
    const config = { ...baseConfig, documentationUrl: undefined };
    const card = generateUnifiedAgentCard(config);
    expect(card.documentationUrl).toBe("https://api.example.com/openapi.json");
  });
});

describe("generateUnifiedLlmsTxt", () => {
  it("generates llms.txt with skills as sections", () => {
    const txt = generateUnifiedLlmsTxt(baseConfig);
    expect(txt).toContain("# Widget API");
    expect(txt).toContain("> REST API for widgets");
    expect(txt).toContain("## Search Widgets");
    expect(txt).toContain("Full-text search across all widgets");
    expect(txt).toContain("- Find red widgets");
    expect(txt).toContain("## Widget CRUD");
  });

  it("includes extra llmsTxtSections", () => {
    const config = {
      ...baseConfig,
      llmsTxtSections: [{ title: "Authentication", content: "Use OAuth2 bearer tokens." }],
    };
    const txt = generateUnifiedLlmsTxt(config);
    expect(txt).toContain("## Authentication");
    expect(txt).toContain("Use OAuth2 bearer tokens.");
  });
});

describe("generateUnifiedLlmsFullTxt", () => {
  it("includes API endpoints from routes", () => {
    const txt = generateUnifiedLlmsFullTxt(baseConfig);
    expect(txt).toContain("## API Endpoints");
    expect(txt).toContain("### GET /api/widgets");
    expect(txt).toContain("### POST /api/widgets");
    expect(txt).toContain("`name` (body)");
  });
});

describe("generateAgentsTxt", () => {
  it("generates default agents.txt when no config", () => {
    const config = { ...baseConfig, agentsTxt: undefined };
    const txt = generateAgentsTxt(config);
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /");
    expect(txt).toContain("Widget API");
  });

  it("generates agents.txt from blocks", () => {
    const config: UnifiedDiscoveryConfig = {
      ...baseConfig,
      agentsTxt: {
        blocks: [
          {
            userAgent: "*",
            rules: [
              { path: "/api/*", permission: "allow" },
              { path: "/admin/*", permission: "disallow" },
            ],
          },
          {
            userAgent: "GPTBot",
            rules: [{ path: "/", permission: "disallow" }],
          },
        ],
        sitemapUrl: "https://api.example.com/sitemap.xml",
        comment: "AI agent access rules",
      },
    };
    const txt = generateAgentsTxt(config);
    expect(txt).toContain("# AI agent access rules");
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /api/*");
    expect(txt).toContain("Disallow: /admin/*");
    expect(txt).toContain("User-agent: GPTBot");
    expect(txt).toContain("Disallow: /");
    expect(txt).toContain("Sitemap: https://api.example.com/sitemap.xml");
  });
});

describe("generateAllDiscovery", () => {
  it("generates all formats by default", () => {
    const docs = generateAllDiscovery(baseConfig);
    expect(docs.has("/.well-known/ai")).toBe(true);
    expect(docs.has("/.well-known/agent.json")).toBe(true);
    expect(docs.has("/llms.txt")).toBe(true);
    expect(docs.has("/llms-full.txt")).toBe(true);
    expect(docs.has("/agents.txt")).toBe(true);
    expect(docs.size).toBe(5);
  });

  it("skips disabled formats", () => {
    const config: UnifiedDiscoveryConfig = {
      ...baseConfig,
      formats: { agentsTxt: false, llmsTxt: false },
    };
    const docs = generateAllDiscovery(config);
    expect(docs.has("/agents.txt")).toBe(false);
    expect(docs.has("/llms.txt")).toBe(false);
    expect(docs.has("/llms-full.txt")).toBe(false);
    expect(docs.has("/.well-known/ai")).toBe(true);
    expect(docs.has("/.well-known/agent.json")).toBe(true);
    expect(docs.size).toBe(2);
  });

  it("returns correct types for each format", () => {
    const docs = generateAllDiscovery(baseConfig);
    expect(typeof docs.get("/.well-known/ai")).toBe("object");
    expect(typeof docs.get("/.well-known/agent.json")).toBe("object");
    expect(typeof docs.get("/llms.txt")).toBe("string");
    expect(typeof docs.get("/llms-full.txt")).toBe("string");
    expect(typeof docs.get("/agents.txt")).toBe("string");
  });
});
