import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { mcpServer } from "./mcp.js";
import type { McpServerConfig } from "./mcp.js";
import { testRoutes, testMcpConfig } from "@agent-layer/core";

function createApp(config: McpServerConfig = testMcpConfig) {
  const app = Fastify();
  const mcp = mcpServer(config);
  app.register(mcp.plugin());
  return { app, mcp };
}

describe("mcpServer (Fastify)", () => {
  it("generates tools from routes", () => {
    const { mcp } = createApp();
    expect(mcp.tools).toHaveLength(3);
    expect(mcp.tools[0].name).toBe("get_api_users");
    expect(mcp.tools[1].name).toBe("post_api_users");
    expect(mcp.tools[2].name).toBe("get_api_users_by_id");
  });

  it("handles initialize request", async () => {
    const { app } = createApp();
    const res = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe(1);
    expect(body.result.protocolVersion).toBe("2025-03-26");
    expect(body.result.serverInfo.name).toBe("test-api");
    expect(body.result.capabilities.tools).toEqual({});
  });

  it("handles tools/list request", async () => {
    const { app } = createApp();
    const res = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.tools).toHaveLength(3);
    expect(body.result.tools[0].name).toBe("get_api_users");
    expect(body.result.tools[0].description).toBe("List all users");
  });

  it("handles tools/call request", async () => {
    const { app } = createApp();
    const res = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "get_api_users",
          arguments: { limit: "10" },
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.content).toBeDefined();
    expect(body.result.content[0].type).toBe("text");
    const parsed = JSON.parse(body.result.content[0].text);
    expect(parsed.method).toBe("GET");
    expect(parsed.url).toBe("/api/users?limit=10");
  });

  it("returns error for unknown tool", async () => {
    const { app } = createApp();
    const res = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: { name: "nonexistent_tool" },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.error.code).toBe(-32602);
  });

  it("returns error for invalid JSON-RPC", async () => {
    const { app } = createApp();
    const res = await app.inject({
      method: "POST",
      url: "/",
      payload: { invalid: true },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe(-32600);
  });
});
