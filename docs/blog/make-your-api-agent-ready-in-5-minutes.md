# Make Your Express API Agent-Ready in 5 Minutes

*Your API returns `200 OK` for pages that don't exist. It serves 500K tokens of JavaScript for a simple page. It has no machine-readable way to discover what it does. AI agents hate it.*

We [scored 20 popular websites](https://company.lightlayer.dev/blog/we-scored-20-websites-on-agent-readiness.html) on agent-readiness. The average score was **38 out of 100**. Most APIs weren't built for a world where AI agents are the primary consumers — but that world is here.

Here's how to fix it in 5 minutes.

## The Problem

AI agents interact with APIs differently than humans. They need:

1. **Structured errors** — JSON with error codes, not HTML 404 pages
2. **Rate limit awareness** — `X-RateLimit-Remaining` and `Retry-After` headers
3. **Discovery** — a machine-readable manifest describing what your API does
4. **Documentation for LLMs** — `/llms.txt` that agents can read instead of parsing your HTML docs
5. **Authentication discovery** — so agents know *how* to authenticate
6. **Access policies** — `/agents.txt` declaring what agents can and can't do

Most APIs have zero of these. Let's add all of them.

## The Solution: One Line

```bash
npm install @agent-layer/core @agent-layer/express
```

```typescript
import express from "express";
import { agentLayer } from "@agent-layer/express";

const app = express();

app.use(agentLayer({
  // Structured JSON errors (no more 200 OK for 404s)
  errors: true,
  
  // Rate limit headers on every response
  rateLimit: { max: 100, windowMs: 60_000 },
  
  // /llms.txt — a plain-text summary agents read
  llmsTxt: {
    title: "Widget API",
    description: "REST API for managing widgets",
    sections: [
      { title: "Authentication", content: "Use Bearer tokens in the Authorization header." },
      { title: "Pagination", content: "All list endpoints accept ?limit and ?offset params." },
    ],
  },
  
  // /.well-known/ai — agent discovery manifest
  discovery: {
    manifest: {
      name: "Widget API",
      description: "REST API for widgets",
      openapi_url: "/openapi.json",
      auth: { type: "bearer" },
      capabilities: ["search", "crud", "export"],
    },
  },
  
  // /.well-known/agent.json — A2A Agent Card (Google's protocol)
  a2a: {
    card: {
      protocolVersion: "1.0.0",
      name: "Widget API",
      url: "https://api.widgets.com",
      description: "Manage widgets programmatically",
      skills: [
        { id: "search", name: "Search Widgets", description: "Full-text search" },
        { id: "crud", name: "Widget CRUD", description: "Create, read, update, delete" },
      ],
    },
  },
  
  // /agents.txt — robots.txt for AI agents
  agentsTxt: {
    siteName: "Widget API",
    rules: [
      {
        agent: "*",
        allow: ["/api/public/*"],
        deny: ["/api/admin/*"],
        rateLimit: { max: 100, windowSeconds: 60 },
      },
    ],
  },
}));

// Your actual routes
app.get("/api/widgets", listWidgets);
app.post("/api/widgets", createWidget);
app.get("/api/widgets/:id", getWidget);

app.listen(3000);
```

That one `app.use()` call just added:

- ✅ **Structured JSON errors** — agents get parseable error objects, not HTML
- ✅ **Rate limit headers** — `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`
- ✅ **`/llms.txt`** — LLM-optimized documentation
- ✅ **`/.well-known/ai`** — agent discovery manifest
- ✅ **`/.well-known/agent.json`** — Google A2A protocol Agent Card
- ✅ **`/agents.txt`** — access policies for AI agents
- ✅ **OAuth discovery** — `/.well-known/oauth-authorization-server`

Your API just went from "agent-hostile" to "agent-native."

## Or Use the Unified Discovery Shortcut

If configuring each format separately feels like too much, use unified discovery — one config, all formats:

```typescript
import { unifiedDiscoveryRoutes } from "@agent-layer/express";

const discovery = unifiedDiscoveryRoutes({
  name: "Widget API",
  description: "REST API for widgets",
  url: "https://api.widgets.com",
  auth: { type: "oauth2", tokenUrl: "https://auth.widgets.com/token" },
  skills: [
    { id: "search", name: "Search", description: "Full-text search" },
  ],
  agentRules: [
    { agent: "*", allow: ["/api/*"], rateLimit: { max: 100 } },
  ],
});

// One config → all six discovery endpoints
app.get("/.well-known/ai", discovery.wellKnownAi);
app.get("/.well-known/agent.json", discovery.agentCard);
app.get("/agents.txt", discovery.agentsTxt);
app.get("/llms.txt", discovery.llmsTxt);
app.get("/llms-full.txt", discovery.llmsFullTxt);
```

## Want MCP Too?

MCP (Model Context Protocol) is the industry standard for agent-tool communication — 97 million monthly SDK downloads. Add an MCP server to your existing routes:

```typescript
import { mcpServer } from "@agent-layer/express";

const mcp = mcpServer({
  name: "widget-api",
  instructions: "Use these tools to manage widgets",
  routes: [
    { method: "GET", path: "/api/widgets", summary: "List widgets",
      parameters: [{ name: "limit", in: "query" }] },
    { method: "POST", path: "/api/widgets", summary: "Create widget",
      parameters: [{ name: "name", in: "body", required: true }] },
  ],
});

app.use("/mcp", mcp.router());
```

Your API now speaks MCP. Any MCP-compatible agent (Claude, GPT, Gemini) can discover and call your endpoints.

## Not Using Express?

agent-layer supports **4 TypeScript frameworks** and **3 Python frameworks**:

| Framework | Package |
|-----------|---------|
| Express | `@agent-layer/express` |
| Koa | `@agent-layer/koa` |
| Hono | `@agent-layer/hono` |
| Fastify | `@agent-layer/fastify` |
| FastAPI | `pip install agent-layer[fastapi]` |
| Flask | `pip install agent-layer[flask]` |
| Django | `pip install agent-layer[django]` |

Same features, same API surface, every framework.

## Check Your Score

Want to know how agent-ready your API is right now?

```bash
npx @agent-layer/cli score https://your-api.com
```

```
🤖 Agent-Readiness Score: 35/100

✅ Structured JSON errors (15/15)
✅ Rate limit headers (10/10)
❌ No discovery endpoint (0/15)
❌ No llms.txt (0/10)
❌ No agents.txt (0/10)
⚠️  OpenAPI spec found but descriptions sparse (7/15)
❌ No MCP endpoint (0/15)
❌ No auth discovery (0/10)

💡 Add @agent-layer/express to hit 95/100:
   npm install @agent-layer/core @agent-layer/express
```

## The Opportunity

There are ~200 million APIs in production today. Almost none of them are agent-ready. The frameworks for building agents (LangChain, Mastra, CrewAI) are exploding — but the APIs those agents need to call? Still stuck in 2019.

agent-layer is the bridge. Drop-in middleware that makes your existing API ready for the agentic web.

**One `npm install`. Five minutes. Agent-ready.**

---

*[agent-layer](https://github.com/lightlayer-dev/agent-layer-ts) is open source (MIT). Star the repo, open an issue, or contribute a framework adapter.*
