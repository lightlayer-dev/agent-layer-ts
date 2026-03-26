import { Hono } from "hono";
import type { Context } from "hono";
import {
  generateToolDefinitions,
  generateServerInfo,
  parseToolName,
  handleJsonRpc,
} from "@agent-layer/core";
import type {
  McpServerConfig,
  McpToolDefinition,
  McpServerInfo,
  JsonRpcRequest,
  ToolCallHandler,
} from "@agent-layer/core";

export type { McpServerConfig };

export function mcpServer(config: McpServerConfig) {
  const serverInfo: McpServerInfo = generateServerInfo(config);

  const autoTools = config.routes
    ? generateToolDefinitions(config.routes)
    : [];
  const manualTools = config.tools || [];
  const allTools: McpToolDefinition[] = [...autoTools, ...manualTools];

  const toolRouteMap = new Map<string, { method: string; path: string }>();
  if (config.routes) {
    for (let i = 0; i < config.routes.length; i++) {
      const route = config.routes[i];
      const toolDef = autoTools[i];
      if (toolDef) {
        toolRouteMap.set(toolDef.name, {
          method: route.method.toUpperCase(),
          path: route.path,
        });
      }
    }
  }

  const defaultToolCallHandler: ToolCallHandler = async (
    toolName: string,
    args: Record<string, unknown>,
  ) => {
    const routeInfo = toolRouteMap.get(toolName);
    if (!routeInfo) {
      const parsed = parseToolName(toolName);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `No route handler for tool: ${toolName}`,
              parsed,
            }),
          },
        ],
      };
    }

    let resolvedPath = routeInfo.path;
    const queryParams: Record<string, string> = {};
    const bodyParams: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      const paramPattern = `:${key}`;
      if (resolvedPath.includes(paramPattern)) {
        resolvedPath = resolvedPath.replace(paramPattern, String(value));
      } else if (routeInfo.method === "GET" || routeInfo.method === "DELETE") {
        queryParams[key] = String(value);
      } else {
        bodyParams[key] = value;
      }
    }

    const qs = new URLSearchParams(queryParams).toString();
    const url = qs ? `${resolvedPath}?${qs}` : resolvedPath;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tool: toolName,
            method: routeInfo.method,
            url,
            body: Object.keys(bodyParams).length > 0 ? bodyParams : undefined,
          }),
        },
      ],
    };
  };

  return {
    app(): Hono {
      const app = new Hono();

      // POST / — receive JSON-RPC messages
      app.post("/", async (c: Context) => {
        const body = (await c.req.json()) as JsonRpcRequest;

        if (!body || !body.jsonrpc || body.jsonrpc !== "2.0") {
          return c.json(
            {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32600, message: "Invalid JSON-RPC request" },
            },
            400,
          );
        }

        const result = handleJsonRpc(body, serverInfo, allTools, defaultToolCallHandler);

        if (result === null) {
          return c.text("", 202);
        }

        const response = await Promise.resolve(result);
        return c.json(response);
      });

      // GET / — SSE stream
      app.get("/", (c: Context) => {
        const sessionId =
          c.req.header("mcp-session-id") || crypto.randomUUID();

        return new Response("", {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Mcp-Session-Id": sessionId,
          },
        });
      });

      // DELETE / — end session
      app.delete("/", (c: Context) => {
        return c.json({ ok: true });
      });

      return app;
    },

    tools: allTools,
    serverInfo,
  };
}
