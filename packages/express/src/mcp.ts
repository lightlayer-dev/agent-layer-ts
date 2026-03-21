import { Router, json } from "express";
import type { Request, Response } from "express";
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
  JsonRpcResponse,
  ToolCallHandler,
} from "@agent-layer/core";

export type { McpServerConfig };

/**
 * Create an Express router that serves an MCP-compatible server.
 *
 * Uses Streamable HTTP transport per the MCP spec:
 * - POST /mcp — receives JSON-RPC messages from clients
 * - GET /mcp  — SSE stream for server-initiated messages
 * - DELETE /mcp — client ends session
 *
 * Tools are auto-generated from route metadata and/or manual definitions.
 * When a tool is called, the middleware makes an internal request to the
 * Express app and returns the response as an MCP tool result.
 */
export function mcpServer(config: McpServerConfig) {
  const serverInfo: McpServerInfo = generateServerInfo(config);

  // Merge auto-generated tools from routes with manually defined tools
  const autoTools = config.routes
    ? generateToolDefinitions(config.routes)
    : [];
  const manualTools = config.tools || [];
  const allTools: McpToolDefinition[] = [...autoTools, ...manualTools];

  // Map tool names to their original route info for internal dispatch
  const toolRouteMap = new Map<
    string,
    { method: string; path: string }
  >();
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

  /**
   * Default tool call handler — resolves route info and returns dispatch details.
   * In a real integration, this would make an internal HTTP request to the app.
   */
  const defaultToolCallHandler: ToolCallHandler = async (
    toolName: string,
    args: Record<string, unknown>
  ) => {
    const routeInfo = toolRouteMap.get(toolName);
    if (!routeInfo) {
      // For manual tools, parse the name
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

    // Build the path, replacing :param with actual values
    let resolvedPath = routeInfo.path;
    const queryParams: Record<string, string> = {};
    const bodyParams: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      const paramPattern = `:${key}`;
      if (resolvedPath.includes(paramPattern)) {
        resolvedPath = resolvedPath.replace(paramPattern, String(value));
      } else if (
        routeInfo.method === "GET" ||
        routeInfo.method === "DELETE"
      ) {
        queryParams[key] = String(value);
      } else {
        bodyParams[key] = value;
      }
    }

    // Build query string
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
            body:
              Object.keys(bodyParams).length > 0 ? bodyParams : undefined,
          }),
        },
      ],
    };
  };

  // SSE connections for server-initiated messages
  const sseClients = new Map<string, Response>();

  return {
    /**
     * Returns an Express router mounted at a prefix (typically /mcp).
     * Handles POST (messages), GET (SSE), and DELETE (session end).
     */
    router(): Router {
      const router = Router();
      router.use(json());

      // POST /mcp — receive JSON-RPC messages
      router.post("/", async (req: Request, res: Response) => {
        const body = req.body as JsonRpcRequest;

        if (!body || !body.jsonrpc || body.jsonrpc !== "2.0") {
          res.status(400).json({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: "Invalid JSON-RPC request" },
          });
          return;
        }

        const result = handleJsonRpc(
          body,
          serverInfo,
          allTools,
          defaultToolCallHandler
        );

        if (result === null) {
          // Notification — no response needed, but send 202
          res.status(202).send();
          return;
        }

        // Handle both sync and async results
        const response = await Promise.resolve(result);
        res.setHeader("Content-Type", "application/json");
        res.json(response);
      });

      // GET /mcp — SSE stream for server-initiated messages
      router.get("/", (req: Request, res: Response) => {
        const sessionId =
          (req.headers["mcp-session-id"] as string) || crypto.randomUUID();

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Mcp-Session-Id", sessionId);
        res.flushHeaders();

        sseClients.set(sessionId, res);

        req.on("close", () => {
          sseClients.delete(sessionId);
        });
      });

      // DELETE /mcp — end session
      router.delete("/", (req: Request, res: Response) => {
        const sessionId = req.headers["mcp-session-id"] as string;
        if (sessionId && sseClients.has(sessionId)) {
          const client = sseClients.get(sessionId);
          client?.end();
          sseClients.delete(sessionId);
        }
        res.status(200).json({ ok: true });
      });

      return router;
    },

    /** Get all registered tool definitions */
    tools: allTools,

    /** Get server info */
    serverInfo,
  };
}
