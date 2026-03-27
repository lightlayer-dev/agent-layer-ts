import { describe, it, expect } from "vitest";
import { discoveryRoutes } from "./discovery.js";

function mockCtx(): any {
  return {
    statusCode: 200,
    status: 200,
    body: null as unknown,
  };
}

describe("discoveryRoutes", () => {
  it("wellKnownAi returns the manifest", () => {
    const handlers = discoveryRoutes({
      manifest: { name: "My API", description: "Test" },
    });
    const ctx = mockCtx();

    handlers.wellKnownAi(ctx);

    expect(ctx.body).toEqual({ name: "My API", description: "Test" });
  });

  it("openApiJson returns the spec when configured", () => {
    const spec = { openapi: "3.0.0", info: { title: "API", version: "1.0" } };
    const handlers = discoveryRoutes({
      manifest: { name: "API" },
      openApiSpec: spec,
    });
    const ctx = mockCtx();

    handlers.openApiJson(ctx);

    expect(ctx.body).toEqual(spec);
  });

  it("openApiJson returns 404 when no spec configured", () => {
    const handlers = discoveryRoutes({ manifest: { name: "API" } });
    const ctx = mockCtx();

    handlers.openApiJson(ctx);

    expect(ctx.status).toBe(404);
    expect(ctx.body.error.code).toBe("no_openapi_spec");
  });

  it("jsonLd returns valid JSON-LD", () => {
    const handlers = discoveryRoutes({
      manifest: { name: "API", description: "A test" },
    });
    const ctx = mockCtx();

    handlers.jsonLd(ctx);

    expect(ctx.body["@context"]).toBe("https://schema.org");
    expect(ctx.body["@type"]).toBe("WebAPI");
    expect(ctx.body["name"]).toBe("API");
  });

  it("manifest includes auth configuration", () => {
    const handlers = discoveryRoutes({
      manifest: {
        name: "API",
        auth: { type: "oauth2", token_url: "https://auth.example.com/token" },
      },
    });
    const ctx = mockCtx();

    handlers.wellKnownAi(ctx);

    expect(ctx.body.auth.type).toBe("oauth2");
    expect(ctx.body.auth.token_url).toBe("https://auth.example.com/token");
  });
});
