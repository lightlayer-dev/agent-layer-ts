import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseArgs } from "./index.js";

// ─── Helpers ──────────────────────────────────────────────────
type FetchFn = typeof globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(handler as FetchFn) as unknown as FetchFn;
  return () => {
    globalThis.fetch = original;
  };
}

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  const headers = new Headers({ "content-type": "application/json", ...extraHeaders });
  return new Response(JSON.stringify(body), { status, headers });
}

function textResponse(body: string, status = 200, extraHeaders?: Record<string, string>): Response {
  const headers = new Headers({ "content-type": "text/plain", ...extraHeaders });
  return new Response(body, { status, headers });
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: new Headers({ "content-type": "text/html" }),
  });
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: new Headers({ "content-type": "text/plain" }),
  });
}

// ─── CLI Argument Parsing ─────────────────────────────────────
describe("parseArgs", () => {
  it("parses score command with URL", () => {
    const result = parseArgs(["node", "cli", "score", "https://example.com"]);
    expect(result.command).toBe("score");
    expect(result.url).toBe("https://example.com");
    expect(result.json).toBe(false);
    expect(result.help).toBe(false);
  });

  it("parses --json flag", () => {
    const result = parseArgs(["node", "cli", "score", "https://example.com", "--json"]);
    expect(result.json).toBe(true);
  });

  it("parses --help flag", () => {
    const result = parseArgs(["node", "cli", "--help"]);
    expect(result.help).toBe(true);
  });

  it("handles no arguments", () => {
    const result = parseArgs(["node", "cli"]);
    expect(result.command).toBeNull();
    expect(result.url).toBeNull();
  });
});

// ─── Individual Checks ────────────────────────────────────────
describe("checkStructuredErrors", () => {
  let restore: () => void;
  afterEach(() => restore?.());

  it("scores 15 for JSON error with full envelope", async () => {
    restore = mockFetch(() =>
      jsonResponse({ error: "Not Found", statusCode: 404, message: "Resource not found" }, 404),
    );

    const { checkStructuredErrors } = await import("./checks/errors.js");
    const result = await checkStructuredErrors("https://api.test");

    expect(result.score).toBe(15);
    expect(result.maxScore).toBe(15);
  });

  it("scores 10 for JSON with partial envelope", async () => {
    restore = mockFetch(() =>
      jsonResponse({ error: "Not Found" }, 404),
    );

    const { checkStructuredErrors } = await import("./checks/errors.js");
    const result = await checkStructuredErrors("https://api.test");

    expect(result.score).toBe(10);
  });

  it("scores 0 for HTML response", async () => {
    restore = mockFetch(() => htmlResponse("<h1>404 Not Found</h1>", 404));

    const { checkStructuredErrors } = await import("./checks/errors.js");
    const result = await checkStructuredErrors("https://api.test");

    expect(result.score).toBe(0);
  });
});

describe("checkDiscovery", () => {
  let restore: () => void;
  afterEach(() => restore?.());

  it("scores 15 for JSON at /.well-known/ai", async () => {
    restore = mockFetch((url) => {
      if (url.includes("/.well-known/ai")) {
        return jsonResponse({ name: "Test API", version: "1.0" });
      }
      return notFound();
    });

    const { checkDiscovery } = await import("./checks/discovery.js");
    const result = await checkDiscovery("https://api.test");

    expect(result.score).toBe(15);
  });

  it("scores 15 for JSON at /.well-known/agent.json", async () => {
    restore = mockFetch((url) => {
      if (url.includes("/.well-known/agent.json")) {
        return jsonResponse({ name: "Test API" });
      }
      return notFound();
    });

    const { checkDiscovery } = await import("./checks/discovery.js");
    const result = await checkDiscovery("https://api.test");

    expect(result.score).toBe(15);
  });

  it("scores 0 when no discovery endpoint", async () => {
    restore = mockFetch(() => notFound());

    const { checkDiscovery } = await import("./checks/discovery.js");
    const result = await checkDiscovery("https://api.test");

    expect(result.score).toBe(0);
  });
});

describe("checkLlmsTxt", () => {
  let restore: () => void;
  afterEach(() => restore?.());

  it("scores 10 for valid llms.txt", async () => {
    restore = mockFetch(() =>
      textResponse("# Test API\nEndpoint: /v1/chat\nAuth: Bearer token\nRate limit: 100/min"),
    );

    const { checkLlmsTxt } = await import("./checks/llms-txt.js");
    const result = await checkLlmsTxt("https://api.test");

    expect(result.score).toBe(10);
  });

  it("scores 0 when not found", async () => {
    restore = mockFetch(() => notFound());

    const { checkLlmsTxt } = await import("./checks/llms-txt.js");
    const result = await checkLlmsTxt("https://api.test");

    expect(result.score).toBe(0);
  });

  it("scores 3 when empty", async () => {
    restore = mockFetch(() => textResponse(""));

    const { checkLlmsTxt } = await import("./checks/llms-txt.js");
    const result = await checkLlmsTxt("https://api.test");

    expect(result.score).toBe(3);
  });
});

describe("checkAgentsTxt", () => {
  let restore: () => void;
  afterEach(() => restore?.());

  it("scores 10 for valid agents.txt", async () => {
    restore = mockFetch(() =>
      textResponse("# Agent Policy\nUser-agent: *\nAllow: /api/\nRate-limit: 100/min"),
    );

    const { checkAgentsTxt } = await import("./checks/agents-txt.js");
    const result = await checkAgentsTxt("https://api.test");

    expect(result.score).toBe(10);
  });

  it("scores 0 when not found", async () => {
    restore = mockFetch(() => notFound());

    const { checkAgentsTxt } = await import("./checks/agents-txt.js");
    const result = await checkAgentsTxt("https://api.test");

    expect(result.score).toBe(0);
  });
});

describe("checkRateLimit", () => {
  let restore: () => void;
  afterEach(() => restore?.());

  it("scores 10 for full rate limit headers", async () => {
    restore = mockFetch(() =>
      jsonResponse({}, 200, {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "99",
        "X-RateLimit-Reset": "1234567890",
      }),
    );

    const { checkRateLimit } = await import("./checks/rate-limit.js");
    const result = await checkRateLimit("https://api.test");

    expect(result.score).toBe(10);
  });

  it("scores 0 when no rate limit headers", async () => {
    restore = mockFetch(() => jsonResponse({}));

    const { checkRateLimit } = await import("./checks/rate-limit.js");
    const result = await checkRateLimit("https://api.test");

    expect(result.score).toBe(0);
  });
});

describe("checkOpenAPI", () => {
  let restore: () => void;
  afterEach(() => restore?.());

  it("scores 15 for valid OpenAPI spec", async () => {
    restore = mockFetch((url) => {
      if (url.includes("/openapi.json")) {
        return jsonResponse({
          openapi: "3.0.0",
          info: { title: "Test API", version: "1.0" },
          paths: {
            "/users": {
              get: { description: "List users", responses: {} },
            },
          },
        });
      }
      return notFound();
    });

    const { checkOpenAPI } = await import("./checks/openapi.js");
    const result = await checkOpenAPI("https://api.test");

    expect(result.score).toBe(15);
  });

  it("scores 10 for OpenAPI without descriptions", async () => {
    restore = mockFetch((url) => {
      if (url.includes("/openapi.json")) {
        return jsonResponse({
          openapi: "3.0.0",
          info: { title: "Test API", version: "1.0" },
          paths: {
            "/users": {
              get: { responses: {} },
            },
          },
        });
      }
      return notFound();
    });

    const { checkOpenAPI } = await import("./checks/openapi.js");
    const result = await checkOpenAPI("https://api.test");

    expect(result.score).toBe(10);
  });

  it("scores 0 when no spec found", async () => {
    restore = mockFetch(() => notFound());

    const { checkOpenAPI } = await import("./checks/openapi.js");
    const result = await checkOpenAPI("https://api.test");

    expect(result.score).toBe(0);
  });
});

describe("checkMCP", () => {
  let restore: () => void;
  afterEach(() => restore?.());

  it("scores 15 for valid JSON-RPC response", async () => {
    restore = mockFetch(() =>
      jsonResponse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          serverInfo: { name: "test", version: "1.0" },
        },
      }),
    );

    const { checkMCP } = await import("./checks/mcp.js");
    const result = await checkMCP("https://api.test");

    expect(result.score).toBe(15);
  });

  it("scores 0 when no MCP endpoint", async () => {
    restore = mockFetch(() => notFound());

    const { checkMCP } = await import("./checks/mcp.js");
    const result = await checkMCP("https://api.test");

    expect(result.score).toBe(0);
  });
});

describe("checkAuth", () => {
  let restore: () => void;
  afterEach(() => restore?.());

  it("scores 10 for OAuth discovery", async () => {
    restore = mockFetch((url) => {
      if (url.includes("oauth-authorization-server")) {
        return jsonResponse({
          issuer: "https://auth.test",
          authorization_endpoint: "https://auth.test/authorize",
          token_endpoint: "https://auth.test/token",
        });
      }
      return notFound();
    });

    const { checkAuth } = await import("./checks/auth.js");
    const result = await checkAuth("https://api.test");

    expect(result.score).toBe(10);
  });

  it("scores 0 when no auth discovery", async () => {
    restore = mockFetch(() => notFound());

    const { checkAuth } = await import("./checks/auth.js");
    const result = await checkAuth("https://api.test");

    expect(result.score).toBe(0);
  });
});

// ─── Scorer Integration ───────────────────────────────────────
describe("scoreUrl", () => {
  let restore: () => void;
  afterEach(() => restore?.());

  it("returns 100/100 for a perfect API", async () => {
    restore = mockFetch((url, init) => {
      // Structured errors check (non-existent path)
      if (url.includes("__agent_layer_nonexistent")) {
        return jsonResponse({ error: "Not Found", statusCode: 404 }, 404);
      }

      // Discovery
      if (url.includes("/.well-known/ai") && !url.includes("oauth") && !url.includes("openid")) {
        return jsonResponse({ name: "Test API", version: "1.0" });
      }

      // llms.txt
      if (url.includes("/llms.txt")) {
        return textResponse("# Test API\nEndpoint: /v1/chat\nAuth: Bearer\nRate: 100/min");
      }

      // agents.txt
      if (url.includes("/agents.txt")) {
        return textResponse("# Agents\nUser-agent: *\nAllow: /api/\nRate-limit: 100/min");
      }

      // OpenAPI
      if (url.includes("/openapi.json")) {
        return jsonResponse({
          openapi: "3.0.0",
          info: { title: "Test", version: "1.0" },
          paths: {
            "/users": { get: { description: "List users", responses: {} } },
          },
        });
      }

      // MCP
      if (url.includes("/mcp") && init?.method === "POST") {
        return jsonResponse({
          jsonrpc: "2.0",
          id: 1,
          result: { protocolVersion: "2025-03-26", capabilities: {} },
        });
      }

      // OAuth
      if (url.includes("oauth-authorization-server")) {
        return jsonResponse({
          issuer: "https://auth.test",
          authorization_endpoint: "https://auth.test/authorize",
          token_endpoint: "https://auth.test/token",
        });
      }

      // Root (rate limit check)
      if (url === "https://api.test") {
        return jsonResponse({}, 200, {
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "99",
          "X-RateLimit-Reset": "1234567890",
        });
      }

      return notFound();
    });

    const { scoreUrl } = await import("./scorer.js");
    const result = await scoreUrl("https://api.test");

    expect(result.totalScore).toBe(100);
    expect(result.maxScore).toBe(100);
    expect(result.checks).toHaveLength(8);
  });

  it("returns 0/100 for an API with nothing", async () => {
    restore = mockFetch(() => htmlResponse("<h1>Not Found</h1>", 404));

    const { scoreUrl } = await import("./scorer.js");
    const result = await scoreUrl("https://api.test");

    expect(result.totalScore).toBe(0);
    expect(result.maxScore).toBe(100);
  });
});

// ─── Reporter ─────────────────────────────────────────────────
describe("formatReport", () => {
  it("produces formatted output with score", async () => {
    const { formatReport } = await import("./reporter.js");

    const report = formatReport({
      url: "https://api.test",
      totalScore: 45,
      maxScore: 100,
      checks: [
        { score: 15, maxScore: 15, label: "Structured JSON errors", detail: "Returns structured JSON" },
        { score: 0, maxScore: 15, label: "Discovery endpoint", detail: "Not found" },
        { score: 10, maxScore: 10, label: "Rate limit headers", detail: "Full headers" },
      ],
    });

    expect(report).toContain("45/100");
    expect(report).toContain("Agent-Readiness Score");
    expect(report).toContain("✅");
    expect(report).toContain("❌");
    expect(report).toContain("api.test");
  });

  it("shows celebration for perfect score", async () => {
    const { formatReport } = await import("./reporter.js");

    const report = formatReport({
      url: "https://api.test",
      totalScore: 100,
      maxScore: 100,
      checks: [],
    });

    expect(report).toContain("Perfect score");
  });
});
