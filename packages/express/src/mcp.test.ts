import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
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
  const app = express();
  const mcp = mcpServer(config);
  app.use("/mcp", mcp.router());
  return { app, mcp };
}

describe("mcpServer", () => {
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
    expect(mcp.serverInfo.instructions).toBe(
      "Use these tools to manage users"
    );
  });
});

describe("POST /mcp — JSON-RPC messages", () => {
  it("handles initialize request", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe("2.0");
    expect(res.body.id).toBe(1);
    expect(res.body.result.protocolVersion).toBe("2025-03-26");
    expect(res.body.result.serverInfo.name).toBe("test-api");
    expect(res.body.result.capabilities.tools).toEqual({});
  });

  it("handles tools/list request", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      });
    expect(res.status).toBe(200);
    expect(res.body.result.tools).toHaveLength(3);
    expect(res.body.result.tools[0].name).toBe("get_api_users");
    expect(res.body.result.tools[0].description).toBe("List all users");
  });

  it("handles tools/call request", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "get_api_users",
          arguments: { limit: "10" },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.result.content).toBeDefined();
    expect(res.body.result.content[0].type).toBe("text");
    // The default handler returns route dispatch info
    const parsed = JSON.parse(res.body.result.content[0].text);
    expect(parsed.method).toBe("GET");
    expect(parsed.url).toBe("/api/users?limit=10");
  });

  it("handles tools/call with path params", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "get_api_users_by_id",
          arguments: { id: "123" },
        },
      });
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.body.result.content[0].text);
    expect(parsed.method).toBe("GET");
    expect(parsed.url).toBe("/api/users/123");
  });

  it("handles tools/call with body params for POST", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "post_api_users",
          arguments: { name: "Alice", email: "alice@example.com" },
        },
      });
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.body.result.content[0].text);
    expect(parsed.method).toBe("POST");
    expect(parsed.body).toEqual({ name: "Alice", email: "alice@example.com" });
  });

  it("returns error for unknown tool", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: { name: "nonexistent_tool" },
      });
    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32602);
  });

  it("returns error for invalid JSON-RPC", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/mcp")
      .send({ invalid: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(-32600);
  });

  it("handles ping", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", id: 7, method: "ping" });
    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({});
  });

  it("handles notifications with 202", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res.status).toBe(202);
  });

  it("handles unknown method", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", id: 8, method: "unknown/method" });
    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32601);
  });
});

describe("GET /mcp — SSE stream", () => {
  it("returns SSE headers", async () => {
    const { app } = createApp();
    // Use a raw http server to test SSE since supertest blocks on streaming
    const http = await import("http");
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address() as { port: number };

    try {
      const res = await fetch(`http://127.0.0.1:${addr.port}/mcp`);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      expect(res.headers.get("cache-control")).toBe("no-cache");
      // Abort the stream to clean up
      if (res.body) {
        await res.body.cancel();
      }
    } finally {
      server.close();
    }
  });
});

describe("DELETE /mcp — session end", () => {
  it("returns 200 OK", async () => {
    const { app } = createApp();
    const res = await request(app).delete("/mcp");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
