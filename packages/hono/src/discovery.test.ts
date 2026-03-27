import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { discoveryRoutes } from "./discovery.js";

describe("discoveryRoutes", () => {
  it("wellKnownAi returns the manifest", async () => {
    const app = new Hono();
    const handlers = discoveryRoutes({
      manifest: { name: "My API", description: "Test" },
    });
    app.get("/.well-known/ai", (c) => handlers.wellKnownAi(c));

    const res = await app.request("/.well-known/ai");
    const body = await res.json() as any;

    expect(body).toEqual({ name: "My API", description: "Test" });
  });

  it("openApiJson returns the spec when configured", async () => {
    const app = new Hono();
    const spec = { openapi: "3.0.0", info: { title: "API", version: "1.0" } };
    const handlers = discoveryRoutes({
      manifest: { name: "API" },
      openApiSpec: spec,
    });
    app.get("/openapi.json", (c) => handlers.openApiJson(c));

    const res = await app.request("/openapi.json");
    const body = await res.json();

    expect(body).toEqual(spec);
  });

  it("openApiJson returns 404 when no spec configured", async () => {
    const app = new Hono();
    const handlers = discoveryRoutes({ manifest: { name: "API" } });
    app.get("/openapi.json", (c) => handlers.openApiJson(c));

    const res = await app.request("/openapi.json");

    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error.code).toBe("no_openapi_spec");
  });

  it("jsonLd returns valid JSON-LD", async () => {
    const app = new Hono();
    const handlers = discoveryRoutes({
      manifest: { name: "API", description: "A test" },
    });
    app.get("/jsonld", (c) => handlers.jsonLd(c));

    const res = await app.request("/jsonld");
    const body = await res.json() as any;

    expect(body["@context"]).toBe("https://schema.org");
    expect(body["@type"]).toBe("WebAPI");
    expect(body["name"]).toBe("API");
  });

  it("manifest includes auth configuration", async () => {
    const app = new Hono();
    const handlers = discoveryRoutes({
      manifest: {
        name: "API",
        auth: { type: "oauth2", token_url: "https://auth.example.com/token" },
      },
    });
    app.get("/.well-known/ai", (c) => handlers.wellKnownAi(c));

    const res = await app.request("/.well-known/ai");
    const body = await res.json() as any;

    expect(body.auth.type).toBe("oauth2");
    expect(body.auth.token_url).toBe("https://auth.example.com/token");
  });
});
