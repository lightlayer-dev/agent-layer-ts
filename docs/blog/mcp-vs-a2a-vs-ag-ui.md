# MCP vs A2A vs AG-UI: Which Agent Protocol Should Your API Support?

*Answer: All of them. Here's why, and how to do it in 10 lines.*

The AI agent ecosystem has crystallized around four protocols. If you're building an API in 2026, you need to understand them — because your next million users might not be humans.

## The Four-Layer Protocol Stack

| Layer | Protocol | What It Does | Adoption |
|-------|----------|-------------|----------|
| Agent ↔ Tools | **MCP** (Model Context Protocol) | How agents connect to APIs and tools | 97M+ monthly SDK downloads |
| Agent ↔ Agent | **A2A** (Agent-to-Agent) | How agents discover and delegate to each other | Donated to Linux Foundation, 50+ partners |
| Agent ↔ Frontend | **AG-UI** (Agent-User Interaction) | How agent backends stream to frontends | CopilotKit, Google ADK, AWS Bedrock |
| Agent ↔ Payment | **x402** | HTTP 402-based micropayments for agent commerce | $24M+ processed |

These aren't competing protocols — they're different layers of the stack. Think of it like TCP/IP: you don't choose between TCP and HTTP, you use both.

## MCP: The Big One

**What:** Created by Anthropic, donated to the Linux Foundation. MCP defines how AI agents discover and call external tools.

**Why it matters:** When Claude, GPT, or Gemini needs to call your API, it uses MCP. With 97 million monthly SDK downloads, MCP is the de facto standard.

**What your API needs:** An MCP endpoint that exposes your routes as "tools" with JSON Schema inputs.

```typescript
import { mcpServer } from "@agent-layer/express";

const mcp = mcpServer({
  name: "my-api",
  routes: [
    { method: "GET", path: "/api/search", summary: "Search products",
      parameters: [{ name: "q", in: "query", required: true }] },
  ],
});

app.use("/mcp", mcp.router());
```

Now any MCP client can discover and call your search endpoint.

## A2A: Agent Discovery

**What:** Google's Agent-to-Agent protocol. Defines how agents discover each other's capabilities via "Agent Cards" at `/.well-known/agent.json`.

**Why it matters:** When an orchestrating agent needs to find and delegate to specialized agents (or APIs that act like agents), it reads the Agent Card.

**What your API needs:**

```typescript
import { a2aRoutes } from "@agent-layer/express";

app.get("/.well-known/agent.json", a2aRoutes({
  card: {
    protocolVersion: "1.0.0",
    name: "Product Search API",
    url: "https://api.example.com",
    skills: [
      { id: "search", name: "Product Search", description: "Full-text product search" },
    ],
  },
}).agentCard);
```

## AG-UI: Agent-to-Frontend Streaming

**What:** Created by CopilotKit. AG-UI defines how agent backends stream responses to frontend UIs using Server-Sent Events (SSE).

**Why it matters:** If you're building agent-powered features in a web app (chat interfaces, copilots, assistants), AG-UI is how the backend talks to the frontend. Google ADK and AWS Bedrock AgentCore are adopting it.

## x402: Agent Payments

**What:** Coinbase's HTTP 402-based micropayment protocol. When an agent hits a paid endpoint, it receives a `402 Payment Required` response with payment instructions, pays automatically, and retries.

**Why it matters:** $24M+ already processed. This is how agents will pay for API calls — no subscription management, no API key provisioning, just pay-per-request.

## The Fragmentation Problem

Here's the catch: discovery is fragmenting. Your API might need to serve:

- `/.well-known/ai` — generic discovery manifest
- `/.well-known/agent.json` — A2A Agent Card
- `/agents.txt` — permission declarations (like robots.txt for agents)
- `/llms.txt` — LLM-optimized documentation
- `/openapi.json` — OpenAPI spec

That's five different files describing the same API. Configure each one separately? No thanks.

## The Solution: Configure Once, Serve Everything

```typescript
import { unifiedDiscoveryRoutes } from "@agent-layer/express";

const discovery = unifiedDiscoveryRoutes({
  name: "Product API",
  description: "E-commerce product search and management",
  url: "https://api.example.com",
  auth: { type: "oauth2", tokenUrl: "https://auth.example.com/token" },
  skills: [
    { id: "search", name: "Search", description: "Full-text product search" },
    { id: "crud", name: "Product CRUD", description: "Manage products" },
  ],
});

// ONE config → ALL formats
app.get("/.well-known/ai", discovery.wellKnownAi);
app.get("/.well-known/agent.json", discovery.agentCard);
app.get("/agents.txt", discovery.agentsTxt);
app.get("/llms.txt", discovery.llmsTxt);
```

One source of truth. Six discovery formats. Zero inconsistency.

## The Bottom Line

Don't pick a protocol. Support all of them. The agent ecosystem is still young — the winners haven't been decided yet. By serving every format, you're:

1. **Maximizing discoverability** — every agent can find you
2. **Future-proofing** — whichever protocols win, you're covered
3. **Reducing maintenance** — one config, not five

The middleware to do this exists today. It's called [agent-layer](https://github.com/lightlayer-dev/agent-layer-ts), it's open source, and it takes 5 minutes to set up.

The agentic web is here. Make sure your API speaks its language.

---

*[agent-layer](https://github.com/lightlayer-dev/agent-layer-ts) supports Express, Koa, Hono, Fastify, FastAPI, Flask, and Django. MIT licensed.*
