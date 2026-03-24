# 🎯 agent-layer GTM Plan: Agent-Ready API Playground

## The Problem We're Solving (for GTM)

agent-layer is a great product but it's invisible. Developers don't know they need it because they've never *seen* an agent-ready API in action. Reading docs doesn't click — **experiencing it does.**

---

## The Strategy: Build a Live Proof

One deployable playground that lets anyone:

1. Hit real API endpoints that are fully agent-ready
2. Point Claude/GPT at the MCP endpoint and watch it actually work
3. See their own API's score side-by-side with the demo
4. Go from "that's cool" to `npm install` in under 2 minutes

---

## What We're Building

**`playground.agent-layer.dev`** — 4 realistic demo APIs running on one VPS:

| Demo | Simulates | Why It Resonates |
|------|-----------|-----------------|
| `/demo/ecommerce` | Shopify-like (products, orders, cart) | Biggest audience — everyone builds e-commerce |
| `/demo/saas` | SaaS platform (users, teams, billing) | Every B2B dev relates |
| `/demo/content` | CMS (posts, comments, media) | Content/blog devs |
| `/demo/fintech` | Stripe-like (accounts, transactions) | High-value audience |

### Each demo includes the full agent-layer stack:
- ✅ MCP server (agents can call endpoints)
- ✅ A2A Agent Card (agent discovery)
- ✅ llms.txt (LLM-optimized docs)
- ✅ agents.txt (access policies)
- ✅ /.well-known/ai (discovery manifest)
- ✅ Structured JSON errors
- ✅ Rate limit headers
- ✅ OpenAPI spec

~200-300 lines each, in-memory data, zero external dependencies.

### The Landing Page shows:
- List of demo APIs with live "Try it" links
- "Test with Claude" button (pre-fills MCP endpoint)
- Agent-readiness score for each demo (95-100/100)
- "Score YOUR API" link → web scorer
- "Make yours agent-ready" → npm install CTA

---

## Why This Is Impactful

### 1. It sells without selling
A running demo is worth 1000 README examples. When someone points Claude at our MCP endpoint and it *just works*, they're sold. No pitch needed.

### 2. Every demo is a content piece
- 4 demo APIs = 4 blog posts ("Making an e-commerce API agent-ready")
- 4 Reddit show-and-tell posts
- 4 Twitter threads with live demos
- 1 "we built a playground" launch post

### 3. It's a testing ground for the agent community
Agent developers need APIs to test against. There's no good "agent-ready test API" out there. We become that. People link to us from tutorials, courses, docs.

### 4. It compounds
Every piece feeds the others:

```
Playground → drives traffic to the scorer
Scorer → shows low scores → drives npm installs
Blog posts → link to playground → link to scorer
Reddit/Twitter → link to playground
All roads lead to: npm install @agent-layer/express
```

---

## Why It's Aligned

This isn't a distraction from the core product — it IS the product in action:

- 🐕 We're **eating our own dogfood** (building with agent-layer)
- 📊 We're **proving the value prop** (look how easy this is)
- 📣 We're **creating distribution** (content, community, SEO)
- 💰 We're **not spending money** (one VPS, open source code)

---

## Full GTM Flywheel

### Tier 1: Build-to-Market (highest ROI)

| Initiative | What | Impact |
|------------|------|--------|
| **Agent-Ready Playground** | Live demo APIs anyone can hit | The core conversion tool |
| **Batch API Scorer + Leaderboard** | Score top 100 APIs, publish results | Viral content ("Stripe scored 35/100") |
| **README Badges** | `![Agent-Ready](score.agent-layer.dev/badge?url=...)` | Every badge = a backlink |
| **`create-agent-layer` scaffolder** | `npx create-agent-layer` → ready-to-go project | Zero-friction onboarding |

### Tier 2: Content Machine

| Initiative | What | Impact |
|------------|------|--------|
| **"5 Minutes" tutorial** | DEV.to post, practical hello-world | 2-5K views, direct conversions |
| **"MCP vs A2A vs AG-UI"** | HN thought leadership piece | Authority, discussion, backlinks |
| **Per-demo blog posts** | One post per playground demo | 4x content from one build |
| **Protocol playground** | Paste OpenAPI → see all discovery formats | Interactive, shareable |

### Tier 3: Ecosystem & Community

| Initiative | What | Impact |
|------------|------|--------|
| **Mastra integration** | Get listed in Mastra's ecosystem | Free distribution to agent devs |
| **Vercel/Cloudflare templates** | One-click deploy templates | Lowers friction to zero |
| **IETF participation** | Implementation reports for agent identity draft | Permanent authority |
| **"awesome-agent-ready" list** | Curated list of 80+ scoring APIs | Flywheel — people adopt to get listed |

---

## Distribution Plan

### Week 1: Build
- [ ] Build playground repo with 4 demo APIs
- [ ] Deploy to VPS with Docker Compose
- [ ] Set up score.agent-layer.dev (web scorer)
- [ ] Build badge server endpoint

### Week 2: Launch
- [ ] Publish "Making an E-commerce API Agent-Ready" on DEV.to
- [ ] Post playground on r/node, r/webdev as show-and-tell
- [ ] Submit "MCP vs A2A vs AG-UI" to Hacker News
- [ ] Twitter threads with live demo videos

### Week 3: Amplify
- [ ] Publish "We Scored 50 Popular APIs" leaderboard
- [ ] Reach out to Mastra team about integration listing
- [ ] Submit Cloudflare Workers example using Hono adapter
- [ ] Post on r/Python with agent-layer-py demos

### Ongoing
- [ ] Score new APIs weekly, publish updates
- [ ] Track llms.txt / agents.txt adoption
- [ ] Engage in agent-related threads with helpful answers
- [ ] Iterate on playground based on feedback

---

## Deliverables

1. **Repo:** `lightlayer-dev/agent-layer-playground`
2. **4 demo APIs** with full agent-layer middleware
3. **Landing page** with try-it links and CTAs
4. **Docker Compose** for one-command deploy
5. **Badge server** for README integration
6. **Blog posts** (2 drafted, 4 more from playground demos)

---

## Success Metrics

| Metric | Target (30 days) |
|--------|-----------------|
| GitHub stars (agent-layer-ts) | 500+ |
| npm weekly downloads | 1,000+ |
| Playground unique visitors | 5,000+ |
| APIs scored via web scorer | 2,000+ |
| Blog post total views | 10,000+ |
| PRs from external contributors | 5+ |
