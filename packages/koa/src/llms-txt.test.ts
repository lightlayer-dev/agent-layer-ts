import { describe, it, expect } from "vitest";
import { llmsTxtRoutes } from "./llms-txt.js";

function mockCtx(): any {
  return {
    type: "",
    body: null as unknown,
  };
}

describe("llmsTxtRoutes", () => {
  it("llmsTxt handler returns text/plain content", () => {
    const handlers = llmsTxtRoutes({ title: "My API" });
    const ctx = mockCtx();

    handlers.llmsTxt(ctx);

    expect(ctx.type).toBe("text/plain");
    expect(ctx.body).toContain("# My API");
  });

  it("llmsFullTxt handler returns text/plain content", () => {
    const handlers = llmsTxtRoutes({ title: "My API" }, [
      { method: "GET", path: "/users", summary: "List users" },
    ]);
    const ctx = mockCtx();

    handlers.llmsFullTxt(ctx);

    expect(ctx.type).toBe("text/plain");
    expect(ctx.body).toContain("# My API");
    expect(ctx.body).toContain("GET /users");
  });

  it("includes description in llmsTxt output", () => {
    const handlers = llmsTxtRoutes({
      title: "API",
      description: "A test API",
    });
    const ctx = mockCtx();

    handlers.llmsTxt(ctx);

    expect(ctx.body).toContain("> A test API");
  });

  it("includes sections in llmsTxt output", () => {
    const handlers = llmsTxtRoutes({
      title: "API",
      sections: [{ title: "Auth", content: "Use tokens." }],
    });
    const ctx = mockCtx();

    handlers.llmsTxt(ctx);

    expect(ctx.body).toContain("## Auth");
    expect(ctx.body).toContain("Use tokens.");
  });

  it("llmsFullTxt includes parameters for routes", () => {
    const handlers = llmsTxtRoutes({ title: "API" }, [
      {
        method: "POST",
        path: "/items",
        parameters: [
          { name: "name", in: "body", required: true, description: "Item name" },
        ],
      },
    ]);
    const ctx = mockCtx();

    handlers.llmsFullTxt(ctx);

    expect(ctx.body).toContain("`name` (body) (required)");
  });
});
