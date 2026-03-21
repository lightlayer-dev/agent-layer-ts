/**
 * MCP (Model Context Protocol) — Tool definition generation.
 *
 * Converts RouteMetadata into MCP-compatible tool definitions,
 * enabling AI agents to discover and call API endpoints via the
 * Model Context Protocol (https://modelcontextprotocol.io).
 *
 * Implements a lightweight MCP-compatible JSON-RPC server without
 * external SDK dependencies — handles initialize, tools/list, and
 * tools/call per the MCP specification.
 */

import type { RouteMetadata, RouteParameter } from "./types.js";

// ── MCP Types ───────────────────────────────────────────────────────────

/** A single MCP tool definition */
export interface McpToolDefinition {
  /** Tool name in snake_case (e.g. get_api_users) */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema describing the tool's input */
  inputSchema: Record<string, unknown>;
}

/** Server info returned during MCP initialize */
export interface McpServerInfo {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Instructions for the agent */
  instructions?: string;
}

/** Configuration for the MCP server middleware */
export interface McpServerConfig {
  /** Manually defined tools (merged with auto-generated ones) */
  tools?: McpToolDefinition[];
  /** Server name */
  name: string;
  /** Server version (default: "1.0.0") */
  version?: string;
  /** Instructions for the agent on how to use these tools */
  instructions?: string;
  /** Route metadata to auto-generate tools from */
  routes?: RouteMetadata[];
}

// ── JSON-RPC Types ──────────────────────────────────────────────────────

/** JSON-RPC 2.0 request */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 response */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ── Tool Name Formatting ────────────────────────────────────────────────

/**
 * Convert HTTP method + path into a snake_case tool name.
 *
 * Examples:
 *   GET  /api/users        → get_api_users
 *   POST /api/users/create → post_api_users_create
 *   GET  /api/users/:id    → get_api_users_by_id
 */
export function formatToolName(method: string, path: string): string {
  const cleanPath = path
    .replace(/^\/+|\/+$/g, "") // strip leading/trailing slashes
    .replace(/:(\w+)/g, "by_$1") // :id → by_id
    .replace(/\{(\w+)\}/g, "by_$1") // {id} → by_id
    .replace(/[^a-zA-Z0-9]+/g, "_") // non-alphanum → underscore
    .replace(/_+/g, "_") // collapse multiple underscores
    .replace(/^_|_$/g, ""); // strip leading/trailing underscores

  return `${method.toLowerCase()}_${cleanPath}`.toLowerCase();
}

// ── JSON Schema Generation ──────────────────────────────────────────────

/**
 * Build a JSON Schema object from route parameters.
 */
export function buildInputSchema(
  params?: RouteParameter[]
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    type: "object",
    properties: {} as Record<string, unknown>,
  };

  if (!params || params.length === 0) {
    return schema;
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of params) {
    const prop: Record<string, unknown> = {
      type: "string",
    };
    if (param.description) {
      prop.description = param.description;
    }
    properties[param.name] = prop;

    if (param.required) {
      required.push(param.name);
    }
  }

  schema.properties = properties;
  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

// ── Tool Generation ─────────────────────────────────────────────────────

/**
 * Generate MCP tool definitions from route metadata.
 *
 * Each route becomes a tool with:
 * - snake_case name derived from method + path
 * - description from route summary/description
 * - inputSchema from route parameters
 */
export function generateToolDefinitions(
  routes: RouteMetadata[]
): McpToolDefinition[] {
  return routes.map((route) => ({
    name: formatToolName(route.method, route.path),
    description:
      route.summary ||
      route.description ||
      `${route.method.toUpperCase()} ${route.path}`,
    inputSchema: buildInputSchema(route.parameters),
  }));
}

// ── Server Info ─────────────────────────────────────────────────────────

/**
 * Generate MCP server info from config.
 */
export function generateServerInfo(config: McpServerConfig): McpServerInfo {
  const info: McpServerInfo = {
    name: config.name,
    version: config.version || "1.0.0",
  };
  if (config.instructions) {
    info.instructions = config.instructions;
  }
  return info;
}

// ── Tool Name Parsing ───────────────────────────────────────────────────

/**
 * Parse a tool name back into HTTP method and path.
 * Reverses formatToolName: get_api_users → { method: "GET", path: "/api/users" }
 */
export function parseToolName(toolName: string): {
  method: string;
  path: string;
} {
  const parts = toolName.split("_");
  const method = (parts[0] || "get").toUpperCase();
  const pathParts = parts.slice(1);

  // Reconstruct path, converting by_X back to :X
  const segments: string[] = [];
  for (let i = 0; i < pathParts.length; i++) {
    if (pathParts[i] === "by" && i + 1 < pathParts.length) {
      segments.push(`:${pathParts[i + 1]}`);
      i++; // skip next
    } else {
      segments.push(pathParts[i]);
    }
  }

  return {
    method,
    path: "/" + segments.join("/"),
  };
}

// ── JSON-RPC Handler ────────────────────────────────────────────────────

/** Tool call handler function type */
export type ToolCallHandler = (
  toolName: string,
  args: Record<string, unknown>
) => Promise<{ content: Array<{ type: string; text: string }> }>;

/**
 * Handle a JSON-RPC request per the MCP protocol.
 *
 * Supports: initialize, notifications/initialized, tools/list, tools/call, ping.
 */
export function handleJsonRpc(
  request: JsonRpcRequest,
  serverInfo: McpServerInfo,
  tools: McpToolDefinition[],
  toolCallHandler?: ToolCallHandler
): JsonRpcResponse | Promise<JsonRpcResponse> | null {
  // Notifications (no id) — acknowledge silently
  if (request.id === undefined || request.id === null) {
    // notifications like notifications/initialized don't need a response
    return null;
  }

  switch (request.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: serverInfo.name,
            version: serverInfo.version,
          },
          ...(serverInfo.instructions
            ? { instructions: serverInfo.instructions }
            : {}),
        },
      };

    case "ping":
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {},
      };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      };

    case "tools/call": {
      const params = request.params as {
        name?: string;
        arguments?: Record<string, unknown>;
      };
      if (!params?.name) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32602,
            message: "Invalid params: tool name is required",
          },
        };
      }

      const tool = tools.find((t) => t.name === params.name);
      if (!tool) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32602,
            message: `Unknown tool: ${params.name}`,
          },
        };
      }

      if (!toolCallHandler) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32603,
            message: "Tool call handler not configured",
          },
        };
      }

      // Return a promise for async tool calls
      return toolCallHandler(params.name, params.arguments || {}).then(
        (result) => ({
          jsonrpc: "2.0" as const,
          id: request.id,
          result,
        }),
        (err) => ({
          jsonrpc: "2.0" as const,
          id: request.id,
          error: {
            code: -32603,
            message:
              err instanceof Error ? err.message : "Internal tool error",
          },
        })
      );
    }

    default:
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      };
  }
}
