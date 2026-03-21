import { describe, it, expect } from "vitest";
import { agentsTxtRoutes } from "./agents-txt.js";

function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    headers: { "user-agent": "TestBot/1.0" },
    path: "/api/test",
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    json(data: unknown) {
      res.body = data;
      return res;
    },
    send(data: unknown) {
      res.body = data;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    setHeader(key: string, value: string) {
      res.headers[key] = value;
      return res;
    },
  };
  return res;
}

describe("agentsTxtRoutes", () => {
  describe("agentsTxt handler", () => {
    it("serves agents.txt as text/plain", () => {
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", allow: ["/api/*"] }],
        siteName: "Test API",
      });
      const res = mockRes();

      handlers.agentsTxt({} as any, res);

      expect(res.headers["Content-Type"]).toBe("text/plain; charset=utf-8");
      expect(res.body).toContain("User-agent: *");
      expect(res.body).toContain("Allow: /api/*");
      expect(res.body).toContain("# Site: Test API");
    });

    it("sets cache-control header", () => {
      const handlers = agentsTxtRoutes({ rules: [{ agent: "*" }] });
      const res = mockRes();

      handlers.agentsTxt({} as any, res);

      expect(res.headers["Cache-Control"]).toBe("public, max-age=3600");
    });
  });

  describe("enforce middleware", () => {
    it("calls next() when enforce is false", () => {
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", deny: ["/*"] }],
        enforce: false,
      });
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      handlers.enforce(mockReq(), mockRes(), next);

      expect(nextCalled).toBe(true);
    });

    it("calls next() when agent is allowed", () => {
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", allow: ["/api/*"] }],
        enforce: true,
      });
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      handlers.enforce(mockReq({ path: "/api/test" }), mockRes(), next);

      expect(nextCalled).toBe(true);
    });

    it("returns 403 when agent is denied", () => {
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "*", deny: ["/api/admin/*"] }],
        enforce: true,
      });
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      const res = mockRes();

      handlers.enforce(
        mockReq({ path: "/api/admin/settings" }),
        res,
        next,
      );

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe("agent_denied");
      expect(res.body.error.docs_url).toBe("/agents.txt");
    });

    it("allows when no matching rule (undefined)", () => {
      const handlers = agentsTxtRoutes({
        rules: [{ agent: "SpecificBot", allow: ["/api/*"] }],
        enforce: true,
      });
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      handlers.enforce(mockReq(), mockRes(), next);

      expect(nextCalled).toBe(true);
    });
  });
});
