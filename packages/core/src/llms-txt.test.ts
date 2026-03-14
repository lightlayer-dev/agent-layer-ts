import { describe, it, expect } from "vitest";
import { generateLlmsTxt, generateLlmsFullTxt } from "./llms-txt.js";

describe("generateLlmsTxt", () => {
  it("generates a title-only document", () => {
    const result = generateLlmsTxt({ title: "My API" });
    expect(result).toBe("# My API\n");
  });

  it("includes description", () => {
    const result = generateLlmsTxt({
      title: "My API",
      description: "A cool API",
    });
    expect(result).toContain("> A cool API");
  });

  it("includes manual sections", () => {
    const result = generateLlmsTxt({
      title: "My API",
      sections: [
        { title: "Auth", content: "Use Bearer tokens." },
        { title: "Limits", content: "100 req/min." },
      ],
    });
    expect(result).toContain("## Auth");
    expect(result).toContain("Use Bearer tokens.");
    expect(result).toContain("## Limits");
    expect(result).toContain("100 req/min.");
  });

  it("ends with a newline", () => {
    const result = generateLlmsTxt({ title: "API" });
    expect(result.endsWith("\n")).toBe(true);
  });

  it("handles empty sections array", () => {
    const result = generateLlmsTxt({ title: "API", sections: [] });
    expect(result).toBe("# API\n");
  });
});

describe("generateLlmsFullTxt", () => {
  it("includes route documentation", () => {
    const result = generateLlmsFullTxt({ title: "My API" }, [
      { method: "GET", path: "/users", summary: "List users" },
    ]);
    expect(result).toContain("## API Endpoints");
    expect(result).toContain("### GET /users");
    expect(result).toContain("List users");
  });

  it("includes route parameters", () => {
    const result = generateLlmsFullTxt({ title: "API" }, [
      {
        method: "POST",
        path: "/users",
        summary: "Create user",
        parameters: [
          { name: "name", in: "body", required: true, description: "User name" },
          { name: "age", in: "body", description: "User age" },
        ],
      },
    ]);
    expect(result).toContain("**Parameters:**");
    expect(result).toContain("`name` (body) (required) — User name");
    expect(result).toContain("`age` (body) — User age");
  });

  it("includes description for routes", () => {
    const result = generateLlmsFullTxt({ title: "API" }, [
      {
        method: "DELETE",
        path: "/users/:id",
        summary: "Delete user",
        description: "Permanently removes a user.",
      },
    ]);
    expect(result).toContain("Permanently removes a user.");
  });

  it("includes base config sections before routes", () => {
    const result = generateLlmsFullTxt(
      {
        title: "API",
        sections: [{ title: "Overview", content: "API overview here." }],
      },
      [{ method: "GET", path: "/health" }],
    );
    const overviewIdx = result.indexOf("## Overview");
    const endpointsIdx = result.indexOf("## API Endpoints");
    expect(overviewIdx).toBeLessThan(endpointsIdx);
  });

  it("handles empty routes array", () => {
    const result = generateLlmsFullTxt({ title: "API" }, []);
    expect(result).not.toContain("## API Endpoints");
  });

  it("uppercases HTTP methods", () => {
    const result = generateLlmsFullTxt({ title: "API" }, [
      { method: "get", path: "/test" },
    ]);
    expect(result).toContain("### GET /test");
  });
});
