import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { discoveryRoutes } from "./discovery.js";

describe("discoveryRoutes (Fastify)", () => {
  it("serves /.well-known/ai with manifest", async () => {
    const app = Fastify();
    await app.register(
      discoveryRoutes({
        manifest: { name: "My API", description: "Test" },
      }),
    );

    const res = await app.inject({ method: "GET", url: "/.well-known/ai" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("My API");
    expect(body.description).toBe("Test");
  });

  it("serves /openapi.json when spec is configured", async () => {
    const spec = { openapi: "3.0.0", info: { title: "API", version: "1.0" } };
    const app = Fastify();
    await app.register(
      discoveryRoutes({ manifest: { name: "API" }, openApiSpec: spec }),
    );

    const res = await app.inject({ method: "GET", url: "/openapi.json" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(spec);
  });

  it("returns 404 for /openapi.json when no spec configured", async () => {
    const app = Fastify();
    await app.register(discoveryRoutes({ manifest: { name: "API" } }));

    const res = await app.inject({ method: "GET", url: "/openapi.json" });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("no_openapi_spec");
  });

  it("serves JSON-LD at /.well-known/jsonld", async () => {
    const app = Fastify();
    await app.register(
      discoveryRoutes({ manifest: { name: "API", description: "Test" } }),
    );

    const res = await app.inject({ method: "GET", url: "/.well-known/jsonld" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body["@context"]).toBe("https://schema.org");
    expect(body["@type"]).toBe("WebAPI");
  });
});
