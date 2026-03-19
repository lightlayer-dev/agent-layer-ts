import { describe, it, expect } from "vitest";
import {
  generateFirestoreOpenApi,
  generateFirestoreRouteMetadata,
  generateFirestoreLlmsTxt,
} from "./discovery.js";
import { testSchemas } from "./fixtures.js";

describe("generateFirestoreOpenApi", () => {
  const spec = generateFirestoreOpenApi(testSchemas, {
    title: "CampusThreads API",
    version: "1.0.0",
    description: "Firestore collections for CampusThreads",
  });

  it("should generate a valid OpenAPI 3.0 spec", () => {
    expect(spec.openapi).toBe("3.0.3");
    expect((spec.info as any).title).toBe("CampusThreads API");
    expect((spec.info as any).version).toBe("1.0.0");
  });

  it("should generate paths for top-level collections", () => {
    const paths = spec.paths as Record<string, unknown>;
    expect(paths["/api/firestore/threads"]).toBeDefined();
    expect(paths["/api/firestore/threads/:id"]).toBeDefined();
  });

  it("should generate paths for parameterized collections", () => {
    const paths = spec.paths as Record<string, unknown>;
    expect(paths["/api/firestore/schools/:schoolId/shifts"]).toBeDefined();
    expect(paths["/api/firestore/schools/:schoolId/shifts/:id"]).toBeDefined();
  });

  it("should generate paths for subcollections", () => {
    const paths = spec.paths as Record<string, unknown>;
    expect(paths["/api/firestore/threads/:id/messages"]).toBeDefined();
    expect(paths["/api/firestore/threads/:id/messages/:id"]).toBeDefined();
  });

  it("should generate paths for nested subcollections", () => {
    const paths = spec.paths as Record<string, unknown>;
    expect(paths["/api/firestore/schools/:schoolId/assets/:id/events"]).toBeDefined();
  });

  it("should generate CRUD operations for each collection", () => {
    const paths = spec.paths as Record<string, any>;
    const threadPath = paths["/api/firestore/threads"];
    expect(threadPath.get).toBeDefined();
    expect(threadPath.post).toBeDefined();

    const threadItemPath = paths["/api/firestore/threads/:id"];
    expect(threadItemPath.get).toBeDefined();
    expect(threadItemPath.put).toBeDefined();
    expect(threadItemPath.delete).toBeDefined();
  });

  it("should generate component schemas", () => {
    const schemas = (spec.components as any).schemas;
    expect(schemas["Threads"]).toBeDefined();
    expect(schemas["Threads"].properties.prospectName).toEqual({ type: "string" });
    expect(schemas["Threads"].properties.resolved).toEqual({ type: "boolean" });
    expect(schemas["Threads"].required).toContain("prospectName");
  });

  it("should map field types correctly", () => {
    const schemas = (spec.components as any).schemas;
    const threadSchema = schemas["Threads"];

    // timestamp → string with date-time format
    expect(threadSchema.properties.lastMessageTime).toEqual({
      type: "string",
      format: "date-time",
    });

    // reference → string with description
    expect(threadSchema.properties.ambassador.type).toBe("string");
    expect(threadSchema.properties.ambassador.description).toContain("users");

    // array
    expect(threadSchema.properties.topics.type).toBe("array");

    // number
    expect(threadSchema.properties.totalMessages).toEqual({ type: "number" });
  });

  it("should respect custom basePath", () => {
    const customSpec = generateFirestoreOpenApi(testSchemas, {
      title: "Test",
      basePath: "/v2/data",
    });
    const paths = Object.keys(customSpec.paths as Record<string, unknown>);
    expect(paths.some((p) => p.startsWith("/v2/data/"))).toBe(true);
  });

  it("should include servers if provided", () => {
    const specWithServers = generateFirestoreOpenApi(testSchemas, {
      title: "Test",
      servers: [{ url: "https://api.example.com", description: "Production" }],
    });
    expect(specWithServers.servers).toEqual([
      { url: "https://api.example.com", description: "Production" },
    ]);
  });
});

describe("generateFirestoreRouteMetadata", () => {
  const routes = generateFirestoreRouteMetadata(testSchemas);

  it("should generate route metadata for all collections", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it("should include CRUD routes for each collection", () => {
    const threadRoutes = routes.filter((r) => r.path === "/api/firestore/threads" || r.path === "/api/firestore/threads/:id");
    const methods = threadRoutes.map((r) => r.method);
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
    expect(methods).toContain("PUT");
    expect(methods).toContain("DELETE");
  });

  it("should include subcollection routes", () => {
    const messageRoutes = routes.filter((r) => r.path.includes("/messages"));
    expect(messageRoutes.length).toBeGreaterThan(0);
  });

  it("should include query parameters for list routes", () => {
    const listRoute = routes.find(
      (r) => r.path === "/api/firestore/threads" && r.method === "GET",
    );
    expect(listRoute?.parameters?.some((p) => p.name === "limit")).toBe(true);
    expect(listRoute?.parameters?.some((p) => p.name === "sort")).toBe(true);
  });

  it("should include path parameters for item routes", () => {
    const getRoute = routes.find(
      (r) => r.path === "/api/firestore/threads/:id" && r.method === "GET",
    );
    expect(getRoute?.parameters?.some((p) => p.name === "id" && p.required)).toBe(true);
  });

  it("should respect custom basePath", () => {
    const customRoutes = generateFirestoreRouteMetadata(testSchemas, "/v2/data");
    expect(customRoutes.some((r) => r.path.startsWith("/v2/data/"))).toBe(true);
  });
});

describe("generateFirestoreLlmsTxt", () => {
  const llmsTxt = generateFirestoreLlmsTxt(testSchemas, {
    title: "CampusThreads API",
    description: "Firestore collections for CampusThreads",
  });

  it("should include the title", () => {
    expect(llmsTxt).toContain("# CampusThreads API");
  });

  it("should include the description", () => {
    expect(llmsTxt).toContain("> Firestore collections for CampusThreads");
  });

  it("should include collection sections", () => {
    expect(llmsTxt).toContain("### Threads");
    expect(llmsTxt).toContain("### Shift Reports");
    expect(llmsTxt).toContain("### Assets");
  });

  it("should include CRUD endpoints", () => {
    expect(llmsTxt).toContain("GET /api/firestore/threads");
    expect(llmsTxt).toContain("POST /api/firestore/threads");
    expect(llmsTxt).toContain("DELETE /api/firestore/threads/:id");
  });

  it("should include field documentation", () => {
    expect(llmsTxt).toContain("`prospectName` (string)");
    expect(llmsTxt).toContain("(required)");
    expect(llmsTxt).toContain("`resolved` (boolean)");
  });

  it("should include subcollection endpoints", () => {
    expect(llmsTxt).toContain("### Messages");
    expect(llmsTxt).toContain("/threads/:id/messages");
  });

  it("should handle parameterized paths", () => {
    expect(llmsTxt).toContain("/schools/:schoolId/shifts");
  });
});
