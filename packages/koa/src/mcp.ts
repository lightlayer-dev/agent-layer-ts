import Router from "@koa/router";
import type { Context } from "koa";
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
    router(): Router {
      const router = new Router();

      // POST /mcp — receive JSON-RPC messages
      router.post("/", async (ctx: Context) => {
        const body = (ctx.request as any).body as JsonRpcRequest;

        if (!body || !body.jsonrpc || body.jsonrpc !== "2.0") {
          ctx.status = 400;
          ctx.body = {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: "Invalid JSON-RPC request" },
          };
          return;
        }

        const result = handleJsonRpc(body, serverInfo, allTools, defaultToolCallHandler);

        if (result === null) {
          ctx.status = 202;
          ctx.body = "";
          return;
        }

        const response = await Promise.resolve(result);
        ctx.type = "application/json";
        ctx.body = response;
      });

      // GET /mcp — SSE stream
      router.get("/", (ctx: Context) => {
        const sessionId =
          (ctx.headers["mcp-session-id"] as string) || crypto.randomUUID();

        ctx.set("Content-Type", "text/event-stream");
        ctx.set("Cache-Control", "no-cache");
        ctx.set("Connection", "keep-alive");
        ctx.set("Mcp-Session-Id", sessionId);
        ctx.status = 200;
        ctx.body = "";
      });

      // DELETE /mcp — end session
      router.delete("/", (ctx: Context) => {
        ctx.status = 200;
        ctx.body = { ok: true };
      });

      return router;
    },

    tools: allTools,
    serverInfo,
  };
}
