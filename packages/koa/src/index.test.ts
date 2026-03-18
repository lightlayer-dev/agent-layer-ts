import { describe, it, expect, vi } from "vitest";

// Mock @koa/router since we're testing composition, not Koa itself
vi.mock("@koa/router", () => {
  class MockRouter {
    _handlers: Record<string, Array<{ path?: string; handler: Function }>> = {
      get: [],
      use: [],
    };

    get(path: string | Function, handler?: Function) {
      if (typeof path === "function") {
        this._handlers.use.push({ handler: path });
      } else {
        this._handlers.get.push({ path, handler: handler! });
      }
      return this;
    }

    use(pathOrHandler: string | Function, handler?: Function) {
      if (typeof pathOrHandler === "function") {
        this._handlers.use.push({ handler: pathOrHandler });
      } else {
        this._handlers.use.push({ path: pathOrHandler, handler: handler! });
      }
      return this;
    }
  }

  return { default: MockRouter };
});

import { agentLayer } from "./index.js";

describe("agentLayer one-liner", () => {
  it("returns a router-like object", () => {
    const router = agentLayer({});
    expect(router).toBeDefined();
    expect(typeof router.use).toBe("function");
    expect(typeof router.get).toBe("function");
  });

  it("registers llms.txt routes when configured", () => {
    const router = agentLayer({
      llmsTxt: { title: "Test API" },
    }) as any;

    const paths = router._handlers.get.map((h: any) => h.path);
    expect(paths).toContain("/llms.txt");
    expect(paths).toContain("/llms-full.txt");
  });

  it("registers discovery routes when configured", () => {
    const router = agentLayer({
      discovery: { manifest: { name: "API" } },
    }) as any;

    const paths = router._handlers.get.map((h: any) => h.path);
    expect(paths).toContain("/.well-known/ai");
    expect(paths).toContain("/openapi.json");
  });

  it("registers auth discovery route when configured", () => {
    const router = agentLayer({
      agentAuth: {
        issuer: "https://auth.example.com",
        tokenUrl: "https://auth.example.com/token",
      },
    }) as any;

    const paths = router._handlers.get.map((h: any) => h.path);
    expect(paths).toContain("/.well-known/oauth-authorization-server");
  });

  it("registers error handlers when errors is not false", () => {
    const router = agentLayer({ errors: true }) as any;
    expect(router._handlers.use.length).toBeGreaterThan(0);
  });

  it("skips features that are disabled", () => {
    const router = agentLayer({
      errors: false,
      rateLimit: false,
      llmsTxt: false,
      discovery: false,
      agentAuth: false,
      agentMeta: false,
    }) as any;

    expect(router._handlers.get.length).toBe(0);
    expect(router._handlers.use.length).toBe(0);
  });
});
