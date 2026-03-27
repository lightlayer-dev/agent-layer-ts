import { describe, it, expect, vi } from "vitest";
import { agentAuth } from "./agent-auth.js";

function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    headers: {},
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
    setHeader(key: string, val: string) {
      res.headers[key.toLowerCase()] = val;
      return res;
    },
  };
  return res;
}

describe("agentAuth", () => {
  const config = {
    issuer: "https://auth.example.com",
    authorizationUrl: "https://auth.example.com/authorize",
    tokenUrl: "https://auth.example.com/token",
    scopes: { read: "Read access", write: "Write access" },
  };

  it("oauthDiscovery returns the discovery document", () => {
    const handlers = agentAuth(config);
    const res = mockRes();

    handlers.oauthDiscovery({} as any, res);

    expect(res.body).toEqual({
      issuer: "https://auth.example.com",
      authorization_endpoint: "https://auth.example.com/authorize",
      token_endpoint: "https://auth.example.com/token",
      scopes_supported: ["read", "write"],
    });
  });

  it("requireAuth returns 401 when no Authorization header", () => {
    const handlers = agentAuth(config);
    const middleware = handlers.requireAuth();
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("authentication_required");
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAuth sets WWW-Authenticate header", () => {
    const handlers = agentAuth(config);
    const middleware = handlers.requireAuth();
    const req = mockReq();
    const res = mockRes();

    middleware(req, res, vi.fn());

    expect(res.headers["www-authenticate"]).toContain("Bearer");
    expect(res.headers["www-authenticate"]).toContain("realm=");
  });

  it("requireAuth calls next when Authorization header is present", () => {
    const handlers = agentAuth(config);
    const middleware = handlers.requireAuth();
    const req = mockReq({ headers: { authorization: "Bearer token123" } });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("uses custom realm", () => {
    const handlers = agentAuth({ ...config, realm: "my-api" });
    const middleware = handlers.requireAuth();
    const req = mockReq();
    const res = mockRes();

    middleware(req, res, vi.fn());

    expect(res.headers["www-authenticate"]).toContain('realm="my-api"');
  });
});
