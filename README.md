# agent-layer

**Make your web app work for AI agents.** One line of code.

Most websites weren't built for AI agents. They return `200 OK` for pages that don't exist, serve 500K tokens of JavaScript for a simple page, and have no machine-readable way to discover what they do. [We scored 20 popular sites](https://company.lightlayer.dev/blog/we-scored-20-websites-on-agent-readiness.html) — the average agent-readiness score was 38%.

agent-layer fixes this with composable Express middleware:

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

That one `app.use()` call adds:
- ✅ Structured JSON error responses (no more `200 OK` for 404s)
- ✅ Rate limit headers on every response (`X-RateLimit-Remaining`, `Retry-After`)
- ✅ `/llms.txt` — a plain-text summary agents read instead of parsing your HTML
- ✅ `/.well-known/ai` — agent discovery manifest
- ✅ HTML transforms — `data-agent-id` attributes for stable selectors
- ✅ OAuth discovery — agents know how to authenticate

## Install

```bash
npm install @agent-layer/core @agent-layer/express
```

## Use individual pieces

Each module works standalone — use what you need:

```ts
import {
  agentErrors,
  notFoundHandler,
  rateLimits,
  llmsTxtRoutes,
  discoveryRoutes,
} from "@agent-layer/express";

// Rate limit headers on every response
app.use(rateLimits({ max: 100, windowMs: 60_000 }));

// Your routes
app.get("/api/users", listUsers);
app.get("/api/products", listProducts);

// Serve /llms.txt
const llms = llmsTxtRoutes({ title: "My API", description: "REST API" });
app.get("/llms.txt", llms.llmsTxt);
app.get("/llms-full.txt", llms.llmsFullTxt);

// Agent discovery
const discovery = discoveryRoutes({
  manifest: { name: "My API", description: "REST API" },
});
app.get("/.well-known/ai", discovery.wellKnownAi);

// Error handling (mount last)
app.use(notFoundHandler());
app.use(agentErrors());
```

## What each module does

### `agentErrors()` — Structured error responses

**Problem:** 15/20 sites we benchmarked return `200 OK` for nonexistent pages.

Catches all errors and returns structured JSON that agents can parse:

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

### `rateLimits()` — Rate limit headers

**Problem:** Almost no sites tell agents when to back off.

Adds `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` to every response. Returns `429` with `Retry-After` when limits are hit.

### `llmsTxtRoutes()` — Machine-readable site summary

**Problem:** Loading a single modern web page costs an agent $0.05–$1.69 in tokens.

Serves `/llms.txt` — a plain-text description of your site in ~500 tokens instead of 500,000.

### `discoveryRoutes()` — API discovery

**Problem:** Agents can't find your API without parsing docs.

Serves `/.well-known/ai` with a JSON manifest pointing to your OpenAPI spec, llms.txt, auth endpoints, and docs.

### `agentMeta()` — HTML transforms

**Problem:** Div soup with auto-generated CSS classes.

Injects `data-agent-id` attributes on interactive elements and ARIA landmarks so browser-based agents can find buttons and forms.

### `agentAuth()` — OAuth discovery

**Problem:** Agents can't "Sign in with Google."

Serves `/.well-known/oauth-authorization-server` so agents know how to authenticate programmatically.

## Validate with agent-bench

```bash
# Before agent-layer
$ agent-bench analyze https://myapp.com
Overall Score: 35%

# After adding agent-layer
$ agent-bench analyze https://myapp.com
Overall Score: 82%
```

[agent-bench](https://github.com/LightLayer-dev/agent-bench) is our open-source benchmark that scores websites on agent-readiness.

## New: Agent Gateway Features

### x402 Payments — HTTP-native micropayments

Accept payments from AI agents via the [x402 protocol](https://x402.org). Agents hit a protected endpoint, get `402 Payment Required`, pay with USDC stablecoin, and retry:

```ts
app.use(agentLayer({
  x402: {
    facilitatorUrl: "https://x402.org/facilitator",
    payeeAddress: "0xYourWallet",
    network: "base-sepolia",
  },
}));
```

### A2A Agent Card — machine-readable capabilities

Serve `/.well-known/agent.json` per [Google's A2A protocol](https://github.com/google/A2A):

```ts
app.use(agentLayer({
  a2a: {
    card: {
      name: "My Service",
      description: "What my service does",
      skills: [{ id: "search", name: "Search", description: "Search things" }],
    },
  },
}));
```

### Agent Identity — credential verification

Verify agent credentials per the [IETF draft-klrc-aiagent-auth](https://datatracker.ietf.org/doc/draft-klrc-aiagent-auth/):

```ts
app.use(agentLayer({
  agentIdentity: {
    issuer: "https://my-app.example.com",
    audience: "https://my-app.example.com",
    jwksUri: "https://my-app.example.com/.well-known/jwks.json",
  },
}));
```

### Analytics — agent traffic telemetry

Detect AI agent traffic, collect telemetry, and batch flush to your analytics backend.

## Packages

| Package | Description |
|---------|-------------|
| `@agent-layer/core` | Framework-agnostic core logic (errors, rate limits, llms.txt, discovery, x402, A2A, agent identity, analytics) |
| `@agent-layer/express` | Express.js middleware |
| `@agent-layer/koa` | Koa middleware |
| `@agent-layer/firestore` | Firestore adapter — schema declaration, query translation, Koa/Express middleware |
| `@agent-layer/strapi` | Strapi plugin — auto-generate agent endpoints from content types |

Python version: **[agent-layer-python](https://github.com/LightLayer-dev/agent-layer-python)** — FastAPI, Flask, and Django support.

## Development

```bash
pnpm install
pnpm build
pnpm test    # 95 tests
```

## License

MIT — [LightLayer](https://company.lightlayer.dev)
