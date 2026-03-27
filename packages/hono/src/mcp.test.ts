import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { mcpServer } from "./mcp.js";
import type { McpServerConfig } from "./mcp.js";
import type { RouteMetadata } from "@agent-layer/core";

const testRoutes: RouteMetadata[] = [
  {
    method: "GET",
    path: "/api/users",
    summary: "List all users",
    parameters: [
      { name: "limit", in: "query", description: "Max results" },
    ],
  },
  {
    method: "POST",
    path: "/api/users",
    summary: "Create a user",
    parameters: [
      { name: "name", in: "body", required: true },
      { name: "email", in: "body", required: true },
    ],
  },
  {
    method: "GET",
    path: "/api/users/:id",
    summary: "Get user by ID",
    parameters: [{ name: "id", in: "path", required: true }],
  },
];

const testConfig: McpServerConfig = {
  name: "test-api",
  version: "1.0.0",
  instructions: "Use these tools to manage users",
  routes: testRoutes,
};

function createApp(config: McpServerConfig = testConfig) {
  const mcp = mcpServer(config);
  const app = new Hono();
  app.route("/mcp", mcp.app());
  return { app, mcp };
}

describe("mcpServer (Hono)", () => {
  it("generates tools from routes", () => {
    const { mcp } = createApp();
    expect(mcp.tools).toHaveLength(3);
    expect(mcp.tools[0].name).toBe("get_api_users");
    expect(mcp.tools[1].name).toBe("post_api_users");
    expect(mcp.tools[2].name).toBe("get_api_users_by_id");
  });

  it("includes manual tools alongside auto-generated ones", () => {
    const { mcp } = createApp({
      ...testConfig,
      tools: [
        {
          name: "custom_tool",
          description: "A custom tool",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    });
    expect(mcp.tools).toHaveLength(4);
    expect(mcp.tools[3].name).toBe("custom_tool");
  });

  it("exposes server info", () => {
    const { mcp } = createApp();
    expect(mcp.serverInfo.name).toBe("test-api");
    expect(mcp.serverInfo.version).toBe("1.0.0");
    expect(mcp.serverInfo.instructions).toBe("Use these tools to manage users");
  });
});

describe("POST /mcp — JSON-RPC", () => {
  it("handles initialize", async () => {
    const { app } = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {} },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe("test-api");
  });

  it("handles tools/list", async () => {
    const { app } = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.tools).toHaveLength(3);
  });

  it("handles tools/call with query params for GET", async () => {
    const { app } = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "get_api_users",
          arguments: { limit: "10" },
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = JSON.parse(body.result.content[0].text);
    expect(parsed.method).toBe("GET");
    expect(parsed.url).toContain("limit=10");
  });

  it("handles tools/call with body params for POST", async () => {
    const { app } = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "post_api_users",
          arguments: { name: "Alice", email: "alice@example.com" },
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = JSON.parse(body.result.content[0].text);
    expect(parsed.method).toBe("POST");
    expect(parsed.body).toEqual({ name: "Alice", email: "alice@example.com" });
  });

  it("returns error for unknown tool", async () => {
    const { app } = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "nonexistent_tool" },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error.code).toBe(-32602);
  });

  it("returns error for invalid JSON-RPC", async () => {
    const { app } = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: true }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe(-32600);
  });

  it("handles ping", async () => {
    const { app } = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 6, method: "ping" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toEqual({});
  });

  it("handles notifications with 202", async () => {
    const { app } = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });

    expect(res.status).toBe(202);
  });

  it("handles unknown method", async () => {
    const { app } = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "unknown/method" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error.code).toBe(-32601);
  });
});

describe("GET /mcp — SSE stream", () => {
  it("returns SSE headers", async () => {
    const { app } = createApp();
    const res = await app.request("/mcp");

    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });
});

describe("DELETE /mcp — session end", () => {
  it("returns 200 OK", async () => {
    const { app } = createApp();
    const res = await app.request("/mcp", { method: "DELETE" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
