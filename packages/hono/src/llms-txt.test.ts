import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { llmsTxtRoutes } from "./llms-txt.js";

describe("llmsTxtRoutes", () => {
  it("llmsTxt handler returns text/plain content", async () => {
    const app = new Hono();
    const handlers = llmsTxtRoutes({ title: "My API" });
    app.get("/llms.txt", (c) => handlers.llmsTxt(c));

    const res = await app.request("/llms.txt");
    const text = await res.text();

    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(text).toContain("# My API");
  });

  it("llmsFullTxt handler returns text/plain content", async () => {
    const app = new Hono();
    const handlers = llmsTxtRoutes({ title: "My API" }, [
      { method: "GET", path: "/users", summary: "List users" },
    ]);
    app.get("/llms-full.txt", (c) => handlers.llmsFullTxt(c));

    const res = await app.request("/llms-full.txt");
    const text = await res.text();

    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(text).toContain("# My API");
    expect(text).toContain("GET /users");
  });

  it("includes description in llmsTxt output", async () => {
    const app = new Hono();
    const handlers = llmsTxtRoutes({
      title: "API",
      description: "A test API",
    });
    app.get("/llms.txt", (c) => handlers.llmsTxt(c));

    const res = await app.request("/llms.txt");
    const text = await res.text();

    expect(text).toContain("> A test API");
  });

  it("includes sections in llmsTxt output", async () => {
    const app = new Hono();
    const handlers = llmsTxtRoutes({
      title: "API",
      sections: [{ title: "Auth", content: "Use tokens." }],
    });
    app.get("/llms.txt", (c) => handlers.llmsTxt(c));

    const res = await app.request("/llms.txt");
    const text = await res.text();

    expect(text).toContain("## Auth");
    expect(text).toContain("Use tokens.");
  });

  it("llmsFullTxt includes parameters for routes", async () => {
    const app = new Hono();
    const handlers = llmsTxtRoutes({ title: "API" }, [
      {
        method: "POST",
        path: "/items",
        parameters: [
          { name: "name", in: "body", required: true, description: "Item name" },
        ],
      },
    ]);
    app.get("/llms-full.txt", (c) => handlers.llmsFullTxt(c));

    const res = await app.request("/llms-full.txt");
    const text = await res.text();

    expect(text).toContain("`name` (body) (required)");
  });
});
