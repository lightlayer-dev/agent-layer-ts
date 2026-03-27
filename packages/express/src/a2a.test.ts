import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { a2aRoutes } from "./a2a.js";
import type { A2AConfig } from "@agent-layer/core";

const testConfig: A2AConfig = {
  card: {
    protocolVersion: "1.0.0",
    name: "test-agent",
    description: "A test agent for unit tests",
    url: "https://example.com/agent",
    provider: { organization: "LightLayer", url: "https://lightlayer.dev" },
    version: "1.0.0",
    capabilities: { streaming: false, pushNotifications: false },
    authentication: { type: "apiKey", in: "header", name: "X-Agent-Key" },
    skills: [
      {
        id: "search",
        name: "Web Search",
        description: "Search the web for information",
        tags: ["search", "web"],
        examples: ["Search for AI agent protocols"],
      },
      {
        id: "summarize",
        name: "Summarize",
        description: "Summarize a document or URL",
        tags: ["nlp", "summarization"],
      },
    ],
  },
};

function createApp(config: A2AConfig) {
  const app = express();
  const handlers = a2aRoutes(config);
  app.get("/.well-known/agent.json", handlers.agentCard);
  return app;
}

describe("a2aRoutes", () => {
  it("serves agent card at /.well-known/agent.json", async () => {
    const app = createApp(testConfig);
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("test-agent");
    expect(res.body.url).toBe("https://example.com/agent");
    expect(res.body.protocolVersion).toBe("1.0.0");
  });

  it("includes all skills", async () => {
    const app = createApp(testConfig);
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.body.skills).toHaveLength(2);
    expect(res.body.skills[0].id).toBe("search");
    expect(res.body.skills[1].id).toBe("summarize");
  });

  it("includes provider info", async () => {
    const app = createApp(testConfig);
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.body.provider.organization).toBe("LightLayer");
  });

  it("includes capabilities", async () => {
    const app = createApp(testConfig);
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.body.capabilities.streaming).toBe(false);
  });

  it("includes authentication scheme", async () => {
    const app = createApp(testConfig);
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.body.authentication.type).toBe("apiKey");
    expect(res.body.authentication.in).toBe("header");
  });

  it("sets cache-control header", async () => {
    const app = createApp(testConfig);
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
  });

  it("sets default input/output modes", async () => {
    const app = createApp(testConfig);
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.body.defaultInputModes).toEqual(["text/plain"]);
    expect(res.body.defaultOutputModes).toEqual(["text/plain"]);
  });
});
