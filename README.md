# agent-layer

A composable TypeScript toolkit that makes web apps and APIs AI-agent-friendly.

## Packages

- **`@agent-layer/core`** — Framework-agnostic core logic (errors, rate limiting, llms.txt, discovery)
- **`@agent-layer/express`** — Express.js middleware adapters

## Quick Start

### One-liner setup (Express)

```ts
import express from "express";
import { agentLayer } from "@agent-layer/express";

const app = express();

app.use(
  agentLayer({
    rateLimit: { max: 100, windowMs: 60_000 },
    llmsTxt: {
      title: "My API",
      description: "A cool API for agents",
      sections: [{ title: "Auth", content: "Use Bearer tokens." }],
    },
    discovery: {
      manifest: {
        name: "My API",
        description: "A cool API",
        openapi_url: "/openapi.json",
        capabilities: ["search", "create"],
      },
    },
    agentAuth: {
      issuer: "https://auth.example.com",
      authorizationUrl: "https://auth.example.com/authorize",
      tokenUrl: "https://auth.example.com/token",
      scopes: { read: "Read access", write: "Write access" },
    },
    errors: true,
  })
);

app.get("/hello", (_req, res) => res.json({ message: "Hello, agent!" }));

app.listen(3000);
```

### Using individual pieces

Each middleware works standalone:

```ts
import { agentErrors, notFoundHandler, rateLimits } from "@agent-layer/express";

// Rate limiting with X-RateLimit-* headers
app.use(rateLimits({ max: 100, windowMs: 60_000 }));

// Your routes here...
app.get("/users", listUsers);

// 404 catch-all + error handler (mount last)
app.use(notFoundHandler());
app.use(agentErrors());
```

### Core library (framework-agnostic)

```ts
import {
  formatError,
  AgentError,
  createRateLimiter,
  generateLlmsTxt,
  generateAIManifest,
} from "@agent-layer/core";

// Format errors into agent-friendly envelopes
const error = formatError({
  code: "validation_failed",
  message: "Email is required",
  status: 422,
  param: "email",
});

// Throw structured errors
throw new AgentError({
  code: "not_found",
  message: "User not found",
  status: 404,
});

// Rate limiting
const check = createRateLimiter({ max: 100 });
const result = await check(request);
if (!result.allowed) {
  // result.retryAfter has the seconds to wait
}

// Generate llms.txt
const txt = generateLlmsTxt({
  title: "My API",
  description: "An API for agents",
  sections: [{ title: "Endpoints", content: "GET /users — list users" }],
});
```

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

MIT
