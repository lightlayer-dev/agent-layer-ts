import { describe, it, expect } from "vitest";
import {
  formatToolName,
  buildInputSchema,
  generateToolDefinitions,
  generateServerInfo,
  parseToolName,
  handleJsonRpc,
} from "./mcp.js";
import type {
  McpServerConfig,
  McpToolDefinition,
  JsonRpcRequest,
  JsonRpcResponse,
} from "./mcp.js";
import type { RouteMetadata } from "./types.js";

// ── formatToolName ──────────────────────────────────────────────────────

describe("formatToolName", () => {
  it("converts GET /api/users to get_api_users", () => {
    expect(formatToolName("GET", "/api/users")).toBe("get_api_users");
  });

  it("converts POST /api/users/create to post_api_users_create", () => {
    expect(formatToolName("POST", "/api/users/create")).toBe(
      "post_api_users_create"
    );
  });

  it("converts route params :id to by_id", () => {
    expect(formatToolName("GET", "/api/users/:id")).toBe(
      "get_api_users_by_id"
    );
  });

  it("converts {id} style params to by_id", () => {
    expect(formatToolName("PUT", "/api/users/{id}")).toBe(
      "put_api_users_by_id"
    );
  });

  it("lowercases everything", () => {
    expect(formatToolName("DELETE", "/API/Users")).toBe("delete_api_users");
  });

  it("handles root path", () => {
    expect(formatToolName("GET", "/")).toBe("get_");
  });

  it("handles multiple params", () => {
    expect(formatToolName("GET", "/api/users/:userId/posts/:postId")).toBe(
      "get_api_users_by_userid_posts_by_postid"
    );
  });

  it("strips trailing slashes", () => {
    expect(formatToolName("GET", "/api/users/")).toBe("get_api_users");
  });
});

// ── buildInputSchema ────────────────────────────────────────────────────

describe("buildInputSchema", () => {
  it("returns empty schema for no params", () => {
    const schema = buildInputSchema();
    expect(schema).toEqual({ type: "object", properties: {} });
  });

  it("returns empty schema for empty array", () => {
    const schema = buildInputSchema([]);
    expect(schema).toEqual({ type: "object", properties: {} });
  });

  it("builds schema with string properties", () => {
    const schema = buildInputSchema([
      { name: "name", in: "query", required: true, description: "User name" },
    ]);
    expect(schema.properties).toEqual({
      name: { type: "string", description: "User name" },
    });
    expect(schema.required).toEqual(["name"]);
  });

  it("includes only required params in required array", () => {
    const schema = buildInputSchema([
      { name: "id", in: "path", required: true },
      { name: "filter", in: "query", required: false },
      { name: "sort", in: "query" },
    ]);
    expect(schema.required).toEqual(["id"]);
    expect(Object.keys(schema.properties as Record<string, unknown>)).toEqual([
      "id",
      "filter",
      "sort",
    ]);
  });

  it("omits required array when no params are required", () => {
    const schema = buildInputSchema([
      { name: "filter", in: "query" },
    ]);
    expect(schema.required).toBeUndefined();
  });
});

// ── generateToolDefinitions ─────────────────────────────────────────────

describe("generateToolDefinitions", () => {
  const routes: RouteMetadata[] = [
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
      description: "Create a new user",
      parameters: [
        { name: "name", in: "body", required: true },
        { name: "email", in: "body", required: true },
      ],
    },
    {
      method: "GET",
      path: "/api/users/:id",
    },
  ];

  it("generates tool definitions from routes", () => {
    const tools = generateToolDefinitions(routes);
    expect(tools).toHaveLength(3);
  });

  it("uses summary for description when available", () => {
    const tools = generateToolDefinitions(routes);
    expect(tools[0].description).toBe("List all users");
  });

  it("falls back to route description", () => {
    const tools = generateToolDefinitions(routes);
    expect(tools[1].description).toBe("Create a new user");
  });

  it("falls back to method + path when no description", () => {
    const tools = generateToolDefinitions(routes);
    expect(tools[2].description).toBe("GET /api/users/:id");
  });

  it("generates correct tool names", () => {
    const tools = generateToolDefinitions(routes);
    expect(tools[0].name).toBe("get_api_users");
    expect(tools[1].name).toBe("post_api_users");
    expect(tools[2].name).toBe("get_api_users_by_id");
  });

  it("includes input schema with parameters", () => {
    const tools = generateToolDefinitions(routes);
    const schema = tools[1].inputSchema;
    expect(schema.required).toEqual(["name", "email"]);
  });
});

// ── generateServerInfo ──────────────────────────────────────────────────

describe("generateServerInfo", () => {
  it("generates server info from config", () => {
    const info = generateServerInfo({
      name: "my-api",
      version: "2.0.0",
      instructions: "Use these tools to manage users",
    });
    expect(info.name).toBe("my-api");
    expect(info.version).toBe("2.0.0");
    expect(info.instructions).toBe("Use these tools to manage users");
  });

  it("defaults version to 1.0.0", () => {
    const info = generateServerInfo({ name: "my-api" });
    expect(info.version).toBe("1.0.0");
  });

  it("omits instructions when not provided", () => {
    const info = generateServerInfo({ name: "my-api" });
    expect(info.instructions).toBeUndefined();
  });
});

// ── parseToolName ───────────────────────────────────────────────────────

describe("parseToolName", () => {
  it("parses get_api_users to GET /api/users", () => {
    const result = parseToolName("get_api_users");
    expect(result.method).toBe("GET");
    expect(result.path).toBe("/api/users");
  });

  it("parses post_api_users to POST /api/users", () => {
    const result = parseToolName("post_api_users");
    expect(result.method).toBe("POST");
    expect(result.path).toBe("/api/users");
  });

  it("parses by_id back to :id", () => {
    const result = parseToolName("get_api_users_by_id");
    expect(result.method).toBe("GET");
    expect(result.path).toBe("/api/users/:id");
  });

  it("handles delete method", () => {
    const result = parseToolName("delete_api_users_by_id");
    expect(result.method).toBe("DELETE");
    expect(result.path).toBe("/api/users/:id");
  });
});

// ── handleJsonRpc ───────────────────────────────────────────────────────

describe("handleJsonRpc", () => {
  const serverInfo = { name: "test-server", version: "1.0.0" };
  const tools: McpToolDefinition[] = [
    {
      name: "get_api_users",
      description: "List users",
      inputSchema: { type: "object", properties: {} },
    },
  ];

  it("handles initialize request", () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    };
    const res = handleJsonRpc(req, serverInfo, tools) as JsonRpcResponse;
    expect(res.id).toBe(1);
    expect((res.result as any).protocolVersion).toBe("2025-03-26");
    expect((res.result as any).serverInfo.name).toBe("test-server");
    expect((res.result as any).capabilities.tools).toEqual({});
  });

  it("handles ping", () => {
    const req: JsonRpcRequest = { jsonrpc: "2.0", id: 2, method: "ping" };
    const res = handleJsonRpc(req, serverInfo, tools) as JsonRpcResponse;
    expect(res.id).toBe(2);
    expect(res.result).toEqual({});
  });

  it("handles tools/list", () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
    };
    const res = handleJsonRpc(req, serverInfo, tools) as JsonRpcResponse;
    const result = res.result as { tools: McpToolDefinition[] };
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("get_api_users");
  });

  it("handles tools/call with handler", async () => {
    const handler = async (name: string, args: Record<string, unknown>) => ({
      content: [{ type: "text", text: `Called ${name}` }],
    });
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_api_users", arguments: {} },
    };
    const res = (await handleJsonRpc(
      req,
      serverInfo,
      tools,
      handler
    )) as JsonRpcResponse;
    expect(res.id).toBe(4);
    expect((res.result as any).content[0].text).toBe("Called get_api_users");
  });

  it("returns error for unknown tool", () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "unknown_tool", arguments: {} },
    };
    const res = handleJsonRpc(req, serverInfo, tools) as JsonRpcResponse;
    expect(res.error?.code).toBe(-32602);
    expect(res.error?.message).toContain("Unknown tool");
  });

  it("returns error for missing tool name", () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {},
    };
    const res = handleJsonRpc(req, serverInfo, tools) as JsonRpcResponse;
    expect(res.error?.code).toBe(-32602);
  });

  it("returns error for unknown method", () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 7,
      method: "unknown/method",
    };
    const res = handleJsonRpc(req, serverInfo, tools) as JsonRpcResponse;
    expect(res.error?.code).toBe(-32601);
  });

  it("returns null for notifications (no id)", () => {
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    } as any;
    const res = handleJsonRpc(req, serverInfo, tools);
    expect(res).toBeNull();
  });

  it("handles tool call handler errors", async () => {
    const handler = async () => {
      throw new Error("Something went wrong");
    };
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "get_api_users", arguments: {} },
    };
    const res = (await handleJsonRpc(
      req,
      serverInfo,
      tools,
      handler
    )) as JsonRpcResponse;
    expect(res.error?.code).toBe(-32603);
    expect(res.error?.message).toBe("Something went wrong");
  });

  it("includes instructions in initialize when configured", () => {
    const infoWithInstructions = {
      ...serverInfo,
      instructions: "Be helpful",
    };
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 9,
      method: "initialize",
    };
    const res = handleJsonRpc(
      req,
      infoWithInstructions,
      tools
    ) as JsonRpcResponse;
    expect((res.result as any).instructions).toBe("Be helpful");
  });
});
