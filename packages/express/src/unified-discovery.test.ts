import { describe, it, expect } from "vitest";
import { unifiedDiscoveryRoutes } from "./unified-discovery.js";

function mockRes(): any {
  const res: any = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    json(data: unknown) {
      res.body = data;
      return res;
    },
    send(data: unknown) {
      res.body = data;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    setHeader(key: string, value: string) {
      res.headers[key] = value;
      return res;
    },
  };
  return res;
}

describe("unifiedDiscoveryRoutes", () => {
  const config = {
    name: "Test API",
    description: "A test API",
    url: "https://api.test.com",
    skills: [{ id: "search", name: "Search", description: "Search things" }],
    auth: { type: "bearer" as const },
    agentRules: [
      { agent: "*", allow: ["/api/*"], rateLimit: { max: 100, windowSeconds: 60 } },
    ],
    llmsSections: [{ title: "Auth", content: "Use Bearer tokens" }],
    routes: [
      { method: "GET", path: "/api/items", summary: "List items" },
    ],
  };

  it("creates all route handlers from a single config", () => {
    const handlers = unifiedDiscoveryRoutes(config);

    expect(handlers.wellKnownAi).toBeDefined();
    expect(handlers.agentCard).toBeDefined();
    expect(handlers.agentsTxt).toBeDefined();
    expect(handlers.llmsTxt).toBeDefined();
    expect(handlers.llmsFullTxt).toBeDefined();
    expect(handlers.jsonLd).toBeDefined();
  });

  it("wellKnownAi returns the manifest", () => {
    const handlers = unifiedDiscoveryRoutes(config);
    const res = mockRes();
    handlers.wellKnownAi!({} as any, res);

    expect(res.body.name).toBe("Test API");
    expect(res.body.description).toBe("A test API");
  });

  it("agentCard returns A2A Agent Card", () => {
    const handlers = unifiedDiscoveryRoutes(config);
    const res = mockRes();
    handlers.agentCard!({} as any, res);

    expect(res.body.name).toBe("Test API");
    expect(res.body.skills).toHaveLength(1);
    expect(res.body.skills[0].id).toBe("search");
    expect(res.headers["Cache-Control"]).toBe("public, max-age=3600");
  });

  it("agentsTxt returns text content", () => {
    const handlers = unifiedDiscoveryRoutes(config);
    const res = mockRes();
    handlers.agentsTxt!({} as any, res);

    expect(res.body).toContain("User-agent: *");
    expect(res.body).toContain("Allow: /api/*");
    expect(res.headers["Content-Type"]).toBe("text/plain; charset=utf-8");
  });

  it("llmsTxt returns llms.txt content", () => {
    const handlers = unifiedDiscoveryRoutes(config);
    const res = mockRes();
    handlers.llmsTxt!({} as any, res);

    expect(res.body).toContain("# Test API");
    expect(res.body).toContain("## Auth");
  });

  it("llmsFullTxt includes route details", () => {
    const handlers = unifiedDiscoveryRoutes(config);
    const res = mockRes();
    handlers.llmsFullTxt!({} as any, res);

    expect(res.body).toContain("GET /api/items");
    expect(res.body).toContain("List items");
  });

  it("returns undefined handlers for disabled formats", () => {
    const handlers = unifiedDiscoveryRoutes({
      name: "API",
      formats: {
        wellKnownAi: true,
        agentCard: false,
        agentsTxt: false,
        llmsTxt: false,
        jsonLd: false,
      },
    });

    expect(handlers.wellKnownAi).toBeDefined();
    expect(handlers.agentCard).toBeUndefined();
    expect(handlers.agentsTxt).toBeUndefined();
    expect(handlers.llmsTxt).toBeUndefined();
  });

  it("serves openapi.json when spec is provided", () => {
    const spec = { openapi: "3.0.0", info: { title: "API" } };
    const handlers = unifiedDiscoveryRoutes({
      name: "API",
      openApiSpec: spec,
    });
    const res = mockRes();
    handlers.openApiJson!({} as any, res);

    expect(res.body).toEqual(spec);
  });

  it("openApiJson is undefined when no spec provided", () => {
    const handlers = unifiedDiscoveryRoutes({ name: "API" });
    expect(handlers.openApiJson).toBeUndefined();
  });
});
