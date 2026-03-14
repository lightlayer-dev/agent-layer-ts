import { describe, it, expect, vi } from "vitest";
import { discoveryRoutes } from "./discovery.js";

function mockRes(): any {
  const res: any = {
    statusCode: 200,
    body: null as unknown,
    json(data: unknown) {
      res.body = data;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
  };
  return res;
}

describe("discoveryRoutes", () => {
  it("wellKnownAi returns the manifest", () => {
    const handlers = discoveryRoutes({
      manifest: { name: "My API", description: "Test" },
    });
    const res = mockRes();

    handlers.wellKnownAi({} as any, res);

    expect(res.body).toEqual({ name: "My API", description: "Test" });
  });

  it("openApiJson returns the spec when configured", () => {
    const spec = { openapi: "3.0.0", info: { title: "API", version: "1.0" } };
    const handlers = discoveryRoutes({
      manifest: { name: "API" },
      openApiSpec: spec,
    });
    const res = mockRes();

    handlers.openApiJson({} as any, res);

    expect(res.body).toEqual(spec);
  });

  it("openApiJson returns 404 when no spec configured", () => {
    const handlers = discoveryRoutes({ manifest: { name: "API" } });
    const res = mockRes();

    handlers.openApiJson({} as any, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("no_openapi_spec");
  });

  it("jsonLd returns valid JSON-LD", () => {
    const handlers = discoveryRoutes({
      manifest: { name: "API", description: "A test" },
    });
    const res = mockRes();

    handlers.jsonLd({} as any, res);

    expect(res.body["@context"]).toBe("https://schema.org");
    expect(res.body["@type"]).toBe("WebAPI");
    expect(res.body["name"]).toBe("API");
  });

  it("manifest includes auth configuration", () => {
    const handlers = discoveryRoutes({
      manifest: {
        name: "API",
        auth: { type: "oauth2", token_url: "https://auth.example.com/token" },
      },
    });
    const res = mockRes();

    handlers.wellKnownAi({} as any, res);

    expect(res.body.auth.type).toBe("oauth2");
    expect(res.body.auth.token_url).toBe("https://auth.example.com/token");
  });
});
