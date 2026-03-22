import type { CheckResult } from "./index.js";

/**
 * MCP Endpoint (15 pts)
 * Check /mcp endpoint responds to POST with JSON-RPC
 */
export async function checkMCP(baseUrl: string): Promise<CheckResult> {
  const maxScore = 15;
  const label = "MCP endpoint";

  try {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "agent-layer-cli", version: "0.1.0" },
        },
      }),
    });

    if (!res.ok) {
      // Some MCP servers might return 405 for wrong method or 404
      if (res.status === 405) {
        return {
          score: 5,
          maxScore,
          label,
          detail: "/mcp exists but returned 405 Method Not Allowed",
        };
      }

      return {
        score: 0,
        maxScore,
        label,
        detail: `No MCP endpoint found (HTTP ${res.status})`,
      };
    }

    const contentType = res.headers.get("content-type") ?? "";

    if (!contentType.includes("json")) {
      return {
        score: 5,
        maxScore,
        label,
        detail: `/mcp responded but not JSON (${contentType})`,
      };
    }

    const body = await res.json();

    // Check for JSON-RPC response
    if (body.jsonrpc === "2.0" && body.result) {
      return {
        score: 15,
        maxScore,
        label,
        detail: "MCP endpoint responds with valid JSON-RPC",
      };
    }

    if (body.jsonrpc === "2.0") {
      return {
        score: 10,
        maxScore,
        label,
        detail: "MCP endpoint responds with JSON-RPC but no result",
      };
    }

    return {
      score: 7,
      maxScore,
      label,
      detail: "/mcp responded with JSON but not JSON-RPC format",
    };
  } catch {
    return {
      score: 0,
      maxScore,
      label,
      detail: "Failed to connect to /mcp endpoint",
    };
  }
}
