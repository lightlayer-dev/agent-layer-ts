# agent-layer

[![CI](https://github.com/LightLayer-dev/agent-layer-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/LightLayer-dev/agent-layer-ts/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Composable middleware to make your web app AI-agent-friendly.** One line of code.

Most websites weren't built for AI agents. They return `200 OK` for pages that don't exist, serve 500K tokens of JavaScript for a simple page, and have no machine-readable way to discover what they do. [We scored 20 popular sites](https://company.lightlayer.dev/blog/we-scored-20-websites-on-agent-readiness.html) — the average agent-readiness score was 38%.

agent-layer fixes this with composable middleware for **Express, Koa, Hono, and Fastify**:

```ts
import express from "express";
import { agentLayer } from "@agent-layer/express";

const app = express();
app.use(agentLayer({
  rateLimit: { max: 100, windowMs: 60_000 },
  llmsTxt: { title: "My API", description: "REST API for widgets" },
  discovery: { manifest: { name: "My API", description: "REST API for widgets" } },
}));
```

That one call adds structured errors, rate limit headers, `/llms.txt`, agent discovery, and more.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [`@agent-layer/core`](packages/core) | Framework-agnostic core logic — errors, rate limits, llms.txt, discovery, MCP, A2A, x402, analytics | `npm i @agent-layer/core` |
| [`@agent-layer/express`](packages/express) | Express middleware (v4 & v5) | `npm i @agent-layer/core @agent-layer/express` |
| [`@agent-layer/koa`](packages/koa) | Koa middleware | `npm i @agent-layer/core @agent-layer/koa` |
| [`@agent-layer/hono`](packages/hono) | Hono middleware (v4+) | `npm i @agent-layer/core @agent-layer/hono` |
| [`@agent-layer/fastify`](packages/fastify) | Fastify plugin (v4+) | `npm i @agent-layer/core @agent-layer/fastify` |
| [`@agent-layer/strapi`](packages/strapi) | Strapi 4 plugin — auto-generate agent endpoints from content types | `npm i @agent-layer/core @agent-layer/strapi` |
| [`@agent-layer/firestore`](packages/firestore) | Firestore adapter — schema declaration, query translation, Express/Koa routes | `npm i @agent-layer/core @agent-layer/firestore` |

Python version: **[agent-layer-python](https://github.com/LightLayer-dev/agent-layer-python)** — FastAPI, Flask, and Django support.

## Feature parity

All four framework adapters support the full feature set. Strapi and Firestore are specialized packages.

| Feature | Core | Express | Koa | Hono | Fastify | Strapi | Firestore |
|---------|:----:|:-------:|:---:|:----:|:-------:|:------:|:---------:|
| Structured errors | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Rate limiting | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| llms.txt | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Discovery (AI manifest) | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Agent meta (HTML) | | ✓ | ✓ | ✓ | ✓ | | |
| OAuth discovery | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Analytics | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| API key auth | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| x402 payments | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| A2A agent card | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Agent identity (JWT/SPIFFE) | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| agents.txt | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Unified discovery | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| MCP server | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Content-type introspection | | | | | | ✓ | |
| Schema / query translation | | | | | | | ✓ |

## Quick start

### Express

```ts
import express from "express";
import { agentLayer } from "@agent-layer/express";

const app = express();
app.use(agentLayer({
  errors: true,
  rateLimit: { max: 100, windowMs: 60_000 },
  llmsTxt: { title: "My API", description: "REST API for widgets" },
  discovery: { manifest: { name: "My API", description: "REST API for widgets" } },
}));
app.listen(3000);
```

### Koa

```ts
import Koa from "koa";
import { agentLayer } from "@agent-layer/koa";

const app = new Koa();
const router = agentLayer({
  rateLimit: { max: 100, windowMs: 60_000 },
  llmsTxt: { title: "My API", description: "REST API for widgets" },
  discovery: { manifest: { name: "My API", description: "REST API for widgets" } },
});
app.use(router.routes()).use(router.allowedMethods());
app.listen(3000);
```

### Hono

```ts
import { Hono } from "hono";
import { agentLayer } from "@agent-layer/hono";

const app = new Hono();
app.route("/", agentLayer({
  rateLimit: { max: 100, windowMs: 60_000 },
  llmsTxt: { title: "My API", description: "REST API for widgets" },
  discovery: { manifest: { name: "My API", description: "REST API for widgets" } },
}));
export default app;
```

### Fastify

```ts
import Fastify from "fastify";
import { agentLayer } from "@agent-layer/fastify";

const fastify = Fastify();
await fastify.register(agentLayer({
  rateLimit: { max: 100, windowMs: 60_000 },
  llmsTxt: { title: "My API", description: "REST API for widgets" },
  discovery: { manifest: { name: "My API", description: "REST API for widgets" } },
}));
await fastify.listen({ port: 3000 });
```

## Use individual modules

Each module works standalone — use what you need. The examples below use Express; all other adapters export the same functions.

### Structured errors

Catches all errors and returns structured JSON that agents can parse. No more `200 OK` for 404s.

```ts
import { agentErrors, notFoundHandler } from "@agent-layer/express";

app.use(notFoundHandler());
app.use(agentErrors());
```

```json
{
  "error": {
    "type": "not_found_error",
    "code": "ROUTE_NOT_FOUND",
    "message": "No route matches GET /api/nonexistent",
    "status": 404,
    "is_retriable": false
  }
}
```

### Rate limiting

Adds `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` to every response. Returns `429` with `Retry-After` when limits are hit.

```ts
import { rateLimits } from "@agent-layer/express";

app.use(rateLimits({ max: 100, windowMs: 60_000 }));
```

### llms.txt — machine-readable site summary

Serves `/llms.txt` — a plain-text description of your site in ~500 tokens instead of 500,000.

```ts
import { llmsTxtRoutes } from "@agent-layer/express";

const llms = llmsTxtRoutes({ title: "My API", description: "REST API" });
app.get("/llms.txt", llms.llmsTxt);
app.get("/llms-full.txt", llms.llmsFullTxt);
```

### Discovery — API manifest

Serves `/.well-known/ai` with a JSON manifest pointing to your OpenAPI spec, llms.txt, auth endpoints, and docs.

```ts
import { discoveryRoutes } from "@agent-layer/express";

const discovery = discoveryRoutes({
  manifest: { name: "My API", description: "REST API" },
});
app.get("/.well-known/ai", discovery.wellKnownAi);
app.get("/openapi.json", discovery.openApiJson);
```

### A2A agent card

Serve `/.well-known/agent.json` per [Google's A2A protocol](https://github.com/google/A2A):

```ts
import { a2aRoutes } from "@agent-layer/express";

const a2a = a2aRoutes({
  card: {
    name: "My Service",
    description: "What my service does",
    skills: [{ id: "search", name: "Search", description: "Search things" }],
  },
});
app.get("/.well-known/agent.json", a2a.agentCard);
```

### x402 payments — HTTP-native micropayments

Accept payments from AI agents via the [x402 protocol](https://x402.org). Agents hit a protected endpoint, get `402 Payment Required`, pay with USDC stablecoin, and retry:

```ts
import { x402Payment } from "@agent-layer/express";

app.use(x402Payment({
  facilitatorUrl: "https://x402.org/facilitator",
  payeeAddress: "0xYourWallet",
  network: "base-sepolia",
}));
```

### Agent identity — credential verification

Verify agent credentials per the [IETF draft-klrc-aiagent-auth](https://datatracker.ietf.org/doc/draft-klrc-aiagent-auth/):

```ts
import { agentIdentity } from "@agent-layer/express";

app.use(agentIdentity({
  issuer: "https://my-app.example.com",
  audience: "https://my-app.example.com",
  jwksUri: "https://my-app.example.com/.well-known/jwks.json",
}));
```

### Analytics — agent traffic telemetry

Detect AI agent traffic, collect telemetry, and batch flush to your analytics backend:

```ts
import { agentAnalytics } from "@agent-layer/express";

app.use(agentAnalytics({
  flushIntervalMs: 10_000,
  onFlush: (events) => console.log(`${events.length} agent events`),
}));
```

### API key auth

Issue and validate scoped API keys for agent access:

```ts
import { apiKeyAuth, requireScope } from "@agent-layer/express";

app.use(apiKeyAuth({ store: myKeyStore }));
app.get("/api/admin", requireScope("admin"), adminHandler);
```

### agents.txt — robots.txt for AI agents

Serve `/agents.txt` to declare which AI agents can access your site and how:

```ts
import { agentsTxtRoutes } from "@agent-layer/express";

const agentsTxt = agentsTxtRoutes({
  rules: [
    { agent: "*", allow: ["/api/*"], disallow: ["/admin/*"] },
  ],
  enforce: true,
});
app.get("/agents.txt", agentsTxt.agentsTxt);
app.use(agentsTxt.enforce());
```

### MCP server — auto-expose API routes as MCP tools

Generate a [Model Context Protocol](https://modelcontextprotocol.io/) server from your existing API routes. AI agents discover and call your endpoints via standard MCP JSON-RPC:

```ts
import { mcpServer } from "@agent-layer/express";

const mcp = mcpServer({
  name: "my-api",
  version: "1.0.0",
  instructions: "Use these tools to manage users",
  routes: [
    { method: "GET", path: "/api/users", summary: "List users",
      parameters: [{ name: "limit", in: "query", description: "Max results" }] },
    { method: "POST", path: "/api/users", summary: "Create user",
      parameters: [{ name: "name", in: "body", required: true }] },
  ],
});
app.use("/mcp", mcp.router());
```

Supports Streamable HTTP transport (POST for JSON-RPC, GET for SSE, DELETE for session end).

### Unified discovery — single config, all formats

Generate all discovery formats from one config — `/.well-known/ai`, `/.well-known/agent.json`, `/llms.txt`, `/llms-full.txt`, `/agents.txt`, and `/openapi.json`:

```ts
import { unifiedDiscovery } from "@agent-layer/express";

const handlers = unifiedDiscovery({
  name: "My API",
  description: "REST API for widgets",
  baseUrl: "https://api.example.com",
  skills: [{ id: "search", name: "Search", description: "Full-text search" }],
  formats: { aiManifest: true, a2a: true, llmsTxt: true, agentsTxt: true },
});
app.get("/.well-known/ai", handlers.wellKnownAi);
app.get("/.well-known/agent.json", handlers.agentCard);
app.get("/llms.txt", handlers.llmsTxt);
app.get("/llms-full.txt", handlers.llmsFullTxt);
app.get("/agents.txt", handlers.agentsTxt);
```

### OAuth discovery

Serves `/.well-known/oauth-authorization-server` so agents know how to authenticate programmatically:

```ts
import { agentAuth } from "@agent-layer/express";

const auth = agentAuth({
  issuer: "https://my-app.example.com",
  authorizationEndpoint: "https://my-app.example.com/oauth/authorize",
  tokenEndpoint: "https://my-app.example.com/oauth/token",
});
app.get("/.well-known/oauth-authorization-server", auth.oauthDiscovery);
```

### Agent meta — HTML transforms

Injects `data-agent-id` attributes on interactive elements and ARIA landmarks so browser-based agents can find buttons and forms:

```ts
import { agentMeta } from "@agent-layer/express";

app.use(agentMeta({ prefix: "app" }));
```

## Validate with `@agent-layer/score`

The `@agent-layer/score` package is a Lighthouse-style CLI that scores your API's agent-readiness across 13 checks: structured errors, discovery endpoints, llms.txt, rate limit headers, OpenAPI, CORS, security headers, agents.txt, and more.

```bash
npx @agent-layer/score https://myapp.com
```

Our automated tests spin up real HTTP servers and verify the score difference — a bare server scores **16/100** while the same server with `agentLayer()` middleware scores **100/100**. See `packages/score/src/scanner-e2e.test.ts` for the full test.

### Agent-Readiness Badge

Add a badge to your README to show your API's agent-readiness score:

```markdown
[![Agent-Ready: 92/100](https://img.shields.io/badge/Agent--Ready-92%2F100-brightgreen)](https://github.com/lightlayer-dev/agent-layer-ts "Scored by @agent-layer/score")
```

The score CLI outputs the badge markdown automatically:

```bash
npx @agent-layer/score https://myapp.com --badge
```

Scored by [**@agent-layer/score**](https://github.com/lightlayer-dev/agent-layer-ts) from [LightLayer](https://company.lightlayer.dev).

## Development

```bash
pnpm install
pnpm build
pnpm test    # 954 tests across 118 test files
```

## See Also

- **[LightLayer Gateway](https://github.com/lightlayer-dev/gateway)** — A standalone reverse proxy that makes any API agent-ready with zero code changes. Same features as agent-layer, but deployed as infrastructure instead of middleware.
- **[agent-layer-python](https://github.com/lightlayer-dev/agent-layer-python)** — Python equivalent for FastAPI, Flask, and Django.

## License

MIT — [LightLayer](https://company.lightlayer.dev)
