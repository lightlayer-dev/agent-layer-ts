/**
 * E2E tests for the score scanner.
 *
 * Spins up real HTTP servers:
 *   1. An "agent-ready" server that serves all the endpoints agent-layer provides
 *   2. A "bare" server that returns nothing useful
 *
 * Then runs the scanner against both and verifies:
 *   - Agent-ready server scores high (>= 60)
 *   - Bare server scores low (<= 25)
 *
 * This proves the scoring system actually validates what agent-layer provides.
 */
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { scan } from "./scanner.js";

// ── Helpers ─────────────────────────────────────────────────────────────

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve(typeof addr === "object" && addr ? addr.port : 0);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

// ── Agent-ready server (mimics agent-layer) ─────────────────────────────

function createAgentReadyServer(): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    // ── Global headers (on ALL responses) ───────────────────────────

    // Rate limit headers
    res.setHeader("X-RateLimit-Limit", "100");
    res.setHeader("X-RateLimit-Remaining", "99");
    res.setHeader("X-RateLimit-Reset", String(Math.floor(Date.now() / 1000) + 60));

    // x402 payment headers on all responses (advertise payment support)
    res.setHeader("X-Payment-Address", "0x1234567890abcdef1234567890abcdef12345678");
    res.setHeader("X-Payment-Network", "base");
    res.setHeader("X-Payment-Currency", "USDC");

    // CORS headers (full set for 10/10)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Agent-Key");
    res.setHeader("Access-Control-Max-Age", "86400");

    // Security headers (full set for 10/10)
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy", "default-src 'self'");

    // Handle CORS preflight
    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Helper for JSON responses with charset
    const jsonResponse = (data: unknown, status = 200) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(data));
    };

    // ── Routes ──────────────────────────────────────────────────────

    if (url === "/.well-known/ai") {
      jsonResponse({
        name: "Test API",
        description: "An agent-ready API powered by agent-layer",
        version: "1.0.0",
        endpoints: ["/api/users", "/api/health"],
      });
    } else if (url === "/.well-known/agent.json") {
      jsonResponse({
        name: "Test Agent",
        description: "E2E test agent",
        url: "http://localhost",
        capabilities: { streaming: false },
        skills: [{ id: "echo", name: "Echo", description: "Echoes input" }],
      });
    } else if (url === "/llms.txt") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(
        "# Test API\n\n> An agent-ready API powered by agent-layer\n\n" +
        "## Endpoints\n\n- GET /api/users — List all users\n- GET /api/health — Health check\n" +
        "This API supports structured JSON errors, rate limiting, and agent discovery.\n",
      );
    } else if (url === "/llms-full.txt") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(
        "# Test API — Full Documentation\n\n> Complete reference for agent consumption\n\n" +
        "## Endpoints\n\n### GET /api/users\nReturns a list of all users.\n\n" +
        "### GET /api/health\nReturns service health status.\n\n" +
        "## Error Format\nAll errors follow the structured error envelope format.\n",
      );
    } else if (url === "/agents.txt") {
      // Full agents.txt with auth + rate-limit for 10/10
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(
        "# agents.txt — Test API\n\n" +
        "User-agent: *\n" +
        "Allow: /api/\n" +
        "Disallow: /admin/\n" +
        "Auth: bearer\n" +
        "Rate-limit: 100/minute\n",
      );
    } else if (url === "/robots.txt") {
      // robots.txt with AI-specific agent rules for 10/10
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(
        "User-agent: *\nAllow: /\n\n" +
        "User-agent: GPTBot\nAllow: /api/\nDisallow: /admin/\n\n" +
        "User-agent: ClaudeBot\nAllow: /api/\nDisallow: /admin/\n\n" +
        "User-agent: Google-Extended\nAllow: /api/\nDisallow: /admin/\n\n" +
        "User-agent: Anthropic\nAllow: /api/\n\n" +
        "Sitemap: http://localhost/sitemap.xml\n",
      );
    } else if (url === "/openapi.json") {
      jsonResponse({
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0", description: "A fully agent-ready API" },
        paths: {
          "/api/users": {
            get: { summary: "List users", description: "Returns all users in the system" },
          },
          "/api/health": {
            get: { summary: "Health check", description: "Returns service health status" },
          },
        },
      });
    } else if (url === "/.well-known/x402") {
      // x402 payment discovery endpoint
      jsonResponse({
        version: "1.0.0",
        accepts: ["ETH", "USDC"],
        paymentAddress: "0x1234567890abcdef1234567890abcdef12345678",
        network: "base",
        description: "Pay-per-call API access for AI agents",
      });
    } else if (url === "/api/__x402_probe__") {
      // Proper 402 response for payment-required routes
      res.statusCode = 402;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("X-Payment-Address", "0x1234567890abcdef1234567890abcdef12345678");
      res.setHeader("X-Payment-Network", "base");
      res.setHeader("X-Payment-Amount", "0.001");
      res.setHeader("X-Payment-Currency", "USDC");
      res.end(JSON.stringify({
        error: "payment_required",
        message: "This endpoint requires payment",
        paymentAddress: "0x1234567890abcdef1234567890abcdef12345678",
        amount: "0.001",
        currency: "USDC",
        network: "base",
      }));
    } else if (url === "/ag-ui" || url === "/api/ag-ui" || url === "/.well-known/ag-ui") {
      // AG-UI streaming endpoint (responds to GET with info, POST for actual streaming)
      if (method === "POST") {
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.end("event: message\ndata: {\"type\":\"connected\"}\n\n");
      } else {
        jsonResponse({
          protocol: "ag-ui",
          version: "1.0.0",
          description: "AG-UI streaming endpoint for real-time agent communication",
          supportedEvents: ["message", "state", "tool_call"],
        });
      }
    } else if (url === "/api/health") {
      jsonResponse({ status: "ok" });
    } else {
      // Structured 404 error (agent-friendly)
      jsonResponse({
        error: {
          type: "not_found_error",
          code: "not_found",
          message: `Route ${url} not found`,
          status: 404,
          is_retriable: false,
        },
      }, 404);
    }
  });
}

// ── Bare server (no agent-layer) ────────────────────────────────────────

function createBareServer(): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    // A typical bare server: only serves its own routes, 404s everything else
    if (req.url === "/" || req.url === "/api/health") {
      res.setHeader("Content-Type", "text/html");
      res.end("<html><body><h1>Hello World</h1></body></html>");
    } else {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html");
      res.end("<html><body><h1>404 Not Found</h1></body></html>");
    }
  });
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("Scanner E2E: agent-ready server vs bare server", () => {
  let agentServer: Server;
  let bareServer: Server;
  let agentPort: number;
  let barePort: number;

  beforeAll(async () => {
    agentServer = createAgentReadyServer();
    bareServer = createBareServer();
    agentPort = await listen(agentServer);
    barePort = await listen(bareServer);
  });

  afterAll(async () => {
    await close(agentServer);
    await close(bareServer);
  });

  it("scores an agent-ready server high (>= 60)", async () => {
    const report = await scan({
      url: `http://127.0.0.1:${agentPort}`,
      timeoutMs: 5000,
    });

    console.log(`Agent-ready server score: ${report.score}/100`);
    console.log("Checks:");
    for (const check of report.checks) {
      console.log(`  ${check.severity === "pass" ? "✅" : check.severity === "warn" ? "⚠️" : "❌"} ${check.name}: ${check.score}/${check.maxScore} — ${check.message}`);
    }

    expect(report.score).toBeGreaterThanOrEqual(95);
    expect(report.checks.length).toBeGreaterThan(0);

    // Verify specific checks pass
    const discoveryCheck = report.checks.find((c) => c.id === "discovery");
    expect(discoveryCheck).toBeDefined();
    expect(discoveryCheck!.score).toBeGreaterThan(0);

    const llmsCheck = report.checks.find((c) => c.id === "llms-txt");
    expect(llmsCheck).toBeDefined();
    expect(llmsCheck!.score).toBeGreaterThan(0);

    const rateLimitCheck = report.checks.find((c) => c.id === "rate-limits");
    expect(rateLimitCheck).toBeDefined();
    expect(rateLimitCheck!.score).toBeGreaterThan(0);
  });

  it("scores a bare server low (<= 25)", async () => {
    const report = await scan({
      url: `http://127.0.0.1:${barePort}`,
      timeoutMs: 5000,
    });

    console.log(`Bare server score: ${report.score}/100`);
    console.log("Checks:");
    for (const check of report.checks) {
      console.log(`  ${check.severity === "pass" ? "✅" : check.severity === "warn" ? "⚠️" : "❌"} ${check.name}: ${check.score}/${check.maxScore} — ${check.message}`);
    }

    expect(report.score).toBeLessThanOrEqual(20);

    // Verify specific checks fail
    const discoveryCheck = report.checks.find((c) => c.id === "discovery");
    expect(discoveryCheck).toBeDefined();
    expect(discoveryCheck!.score).toBe(0);

    const llmsCheck = report.checks.find((c) => c.id === "llms-txt");
    expect(llmsCheck).toBeDefined();
    expect(llmsCheck!.score).toBe(0);
  });

  it("the score improvement is at least 40 points", async () => {
    const agentReport = await scan({
      url: `http://127.0.0.1:${agentPort}`,
      timeoutMs: 5000,
    });
    const bareReport = await scan({
      url: `http://127.0.0.1:${barePort}`,
      timeoutMs: 5000,
    });

    const improvement = agentReport.score - bareReport.score;
    console.log(`\nScore improvement: ${bareReport.score} → ${agentReport.score} (+${improvement} points)`);
    expect(improvement).toBeGreaterThanOrEqual(70);
  });
});
