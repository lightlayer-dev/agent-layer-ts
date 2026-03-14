import { describe, it, expect } from "vitest";
import { generateAIManifest, generateJsonLd } from "./discovery.js";

describe("generateAIManifest", () => {
  it("returns the manifest object", () => {
    const manifest = generateAIManifest({
      manifest: { name: "My API", description: "Test API" },
    });
    expect(manifest.name).toBe("My API");
    expect(manifest.description).toBe("Test API");
  });

  it("includes auth info", () => {
    const manifest = generateAIManifest({
      manifest: {
        name: "API",
        auth: {
          type: "oauth2",
          authorization_url: "https://auth.example.com/authorize",
          token_url: "https://auth.example.com/token",
        },
      },
    });
    expect(manifest.auth?.type).toBe("oauth2");
    expect(manifest.auth?.authorization_url).toBe(
      "https://auth.example.com/authorize",
    );
  });

  it("includes capabilities", () => {
    const manifest = generateAIManifest({
      manifest: { name: "API", capabilities: ["search", "create"] },
    });
    expect(manifest.capabilities).toEqual(["search", "create"]);
  });

  it("includes contact info", () => {
    const manifest = generateAIManifest({
      manifest: {
        name: "API",
        contact: { email: "dev@example.com", url: "https://example.com" },
      },
    });
    expect(manifest.contact?.email).toBe("dev@example.com");
  });

  it("returns a new object (not a reference to the input)", () => {
    const input = { manifest: { name: "API" } };
    const result = generateAIManifest(input);
    expect(result).not.toBe(input.manifest);
    expect(result).toEqual(input.manifest);
  });
});

describe("generateJsonLd", () => {
  it("generates valid JSON-LD with @context and @type", () => {
    const ld = generateJsonLd({ manifest: { name: "API" } });
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("WebAPI");
    expect(ld["name"]).toBe("API");
  });

  it("includes description when present", () => {
    const ld = generateJsonLd({
      manifest: { name: "API", description: "A test API" },
    });
    expect(ld["description"]).toBe("A test API");
  });

  it("includes documentation link from openapi_url", () => {
    const ld = generateJsonLd({
      manifest: { name: "API", openapi_url: "https://api.example.com/openapi.json" },
    });
    expect(ld["documentation"]).toBe("https://api.example.com/openapi.json");
  });

  it("includes contactPoint from contact email", () => {
    const ld = generateJsonLd({
      manifest: { name: "API", contact: { email: "dev@example.com" } },
    });
    expect(ld["contactPoint"]).toEqual({
      "@type": "ContactPoint",
      email: "dev@example.com",
    });
  });

  it("maps capabilities to potentialAction", () => {
    const ld = generateJsonLd({
      manifest: { name: "API", capabilities: ["search", "create"] },
    });
    expect(ld["potentialAction"]).toEqual([
      { "@type": "Action", name: "search" },
      { "@type": "Action", name: "create" },
    ]);
  });

  it("omits optional fields when not configured", () => {
    const ld = generateJsonLd({ manifest: { name: "API" } });
    expect(ld).not.toHaveProperty("description");
    expect(ld).not.toHaveProperty("documentation");
    expect(ld).not.toHaveProperty("contactPoint");
    expect(ld).not.toHaveProperty("potentialAction");
  });
});
