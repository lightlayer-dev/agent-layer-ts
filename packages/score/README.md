# @agent-layer/score

> **Lighthouse for AI agents** — Score any API or website for agent-readiness.

11 checks covering robots.txt, llms.txt, OpenAPI discovery, CORS, structured errors, rate limit headers, response time, content-type, security headers, agent discovery (A2A, agents.txt), and x402 micropayment support.

## CLI Usage

```bash
# Score a URL
npx @agent-layer/score https://api.example.com

# JSON output
npx @agent-layer/score https://api.example.com --json

# Fail if below threshold
npx @agent-layer/score https://api.example.com --threshold 60

# Get a shields.io badge URL
npx @agent-layer/score https://api.example.com --badge
```

## GitHub Action

Add agent-readiness scoring to your CI pipeline. Scores your API on every push or PR and posts results as a comment.

### Quick Start

```yaml
# .github/workflows/agent-readiness.yml
name: Agent-Readiness Score
on: [push, pull_request]

jobs:
  score:
    runs-on: ubuntu-latest
    steps:
      - uses: lightlayer-dev/agent-layer-ts/packages/score@main
        with:
          url: https://api.example.com
          threshold: 50
```

### With Deployment Preview

Score your staging/preview URL after deployment:

```yaml
name: Score Preview
on:
  deployment_status:

jobs:
  score:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: lightlayer-dev/agent-layer-ts/packages/score@main
        with:
          url: ${{ github.event.deployment_status.target_url }}
          threshold: 40
          comment: true
```

### Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `url` | URL to score (required) | — |
| `threshold` | Minimum score (0-100). Fails if below. | `0` |
| `comment` | Post results as PR comment | `true` |
| `json` | Output as JSON | `false` |
| `timeout` | Request timeout (ms) | `10000` |

### Outputs

| Output | Description |
|--------|-------------|
| `score` | Agent-readiness score (0-100) |
| `grade` | Letter grade (A/B/C/D/F) |
| `passed` | Whether score met threshold |
| `badge-url` | Shields.io badge URL |
| `report-json` | Full report as JSON |

### Badge

Add a badge to your README:

```markdown
![Agent-Ready](https://img.shields.io/badge/Agent--Ready-85%2F100-brightgreen)
```

Or use the dynamic `badge-url` output from the action.

## Checks

| # | Check | Max Score | What it tests |
|---|-------|-----------|---------------|
| 1 | robots.txt | 10 | Presence and AI-friendly directives |
| 2 | llms.txt | 10 | LLM-specific content documentation |
| 3 | OpenAPI | 10 | API schema discovery |
| 4 | CORS | 10 | Cross-origin access for agents |
| 5 | Structured Errors | 10 | JSON error responses with codes |
| 6 | Rate Limits | 10 | Rate limit headers (X-RateLimit-*) |
| 7 | Response Time | 10 | Sub-second response times |
| 8 | Content-Type | 10 | Proper content-type headers |
| 9 | Security Headers | 5 | Security headers present |
| 10 | Agent Discovery | 5 | A2A agent card, agents.txt |
| 11 | x402 Payment | 10 | HTTP-native micropayment support |

## Programmatic API

```typescript
import { scan } from "@agent-layer/score";

const report = await scan({ url: "https://api.example.com" });
console.log(report.score); // 0-100
console.log(report.checks); // detailed check results
```

## Improve Your Score

Low score? Add [@agent-layer](https://github.com/lightlayer-dev/agent-layer-ts) middleware:

```bash
npm install @agent-layer/express
```

```typescript
import { agentLayer } from "@agent-layer/express";

app.use(agentLayer({
  llmsTxt: { content: "API for managing todos..." },
  openapi: { spec: "./openapi.yaml" },
  cors: { origins: ["*"] },
}));
```

## License

MIT — [LightLayer](https://company.lightlayer.dev)
