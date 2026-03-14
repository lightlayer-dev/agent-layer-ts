import { describe, it, expect, vi } from "vitest";
import { llmsTxtRoutes } from "./llms-txt.js";

function mockRes(): any {
  const res: any = {
    headers: {} as Record<string, string>,
    body: null as unknown,
    type(t: string) {
      res.headers["content-type"] = t;
      return res;
    },
    send(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe("llmsTxtRoutes", () => {
  it("llmsTxt handler returns text/plain content", () => {
    const handlers = llmsTxtRoutes({ title: "My API" });
    const res = mockRes();

    handlers.llmsTxt({} as any, res);

    expect(res.headers["content-type"]).toBe("text/plain");
    expect(res.body).toContain("# My API");
  });

  it("llmsFullTxt handler returns text/plain content", () => {
    const handlers = llmsTxtRoutes({ title: "My API" }, [
      { method: "GET", path: "/users", summary: "List users" },
    ]);
    const res = mockRes();

    handlers.llmsFullTxt({} as any, res);

    expect(res.headers["content-type"]).toBe("text/plain");
    expect(res.body).toContain("# My API");
    expect(res.body).toContain("GET /users");
  });

  it("includes description in llmsTxt output", () => {
    const handlers = llmsTxtRoutes({
      title: "API",
      description: "A test API",
    });
    const res = mockRes();

    handlers.llmsTxt({} as any, res);

    expect(res.body).toContain("> A test API");
  });

  it("includes sections in llmsTxt output", () => {
    const handlers = llmsTxtRoutes({
      title: "API",
      sections: [{ title: "Auth", content: "Use tokens." }],
    });
    const res = mockRes();

    handlers.llmsTxt({} as any, res);

    expect(res.body).toContain("## Auth");
    expect(res.body).toContain("Use tokens.");
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
    const res = mockRes();

    handlers.llmsFullTxt({} as any, res);

    expect(res.body).toContain("`name` (body) (required)");
  });
});
