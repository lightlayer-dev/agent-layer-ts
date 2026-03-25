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

    // Rate limit headers on ALL responses
    res.setHeader("X-RateLimit-Limit", "100");
    res.setHeader("X-RateLimit-Remaining", "99");
    res.setHeader("X-RateLimit-Reset", String(Math.floor(Date.now() / 1000) + 60));
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    // Security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Strict-Transport-Security", "max-age=31536000");

    if (url === "/.well-known/ai") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        name: "Test API",
        description: "An agent-ready API powered by agent-layer",
        version: "1.0.0",
        endpoints: ["/api/users", "/api/health"],
      }));
    } else if (url === "/.well-known/agent.json") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        name: "Test Agent",
        description: "E2E test agent",
        url: "http://localhost",
        capabilities: { streaming: false },
        skills: [{ id: "echo", name: "Echo", description: "Echoes input" }],
      }));
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
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("User-agent: *\nAllow: /api/\nDisallow: /admin/\n");
    } else if (url === "/robots.txt") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("User-agent: *\nAllow: /\n");
    } else if (url === "/openapi.json") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/api/users": { get: { summary: "List users" } },
          "/api/health": { get: { summary: "Health check" } },
        },
      }));
    } else if (url === "/api/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ status: "ok" }));
    } else if (url === "/.well-known/x402") {
      // No x402 support — that's fine, it's optional
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: { type: "not_found_error", code: "not_found", message: "Not found", status: 404, is_retriable: false },
      }));
    } else {
      // Structured 404 error (agent-friendly)
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: {
          type: "not_found_error",
          code: "not_found",
          message: `Route ${url} not found`,
          status: 404,
          is_retriable: false,
        },
      }));
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

    expect(report.score).toBeGreaterThanOrEqual(60);
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
    expect(improvement).toBeGreaterThanOrEqual(50);
  });
});
