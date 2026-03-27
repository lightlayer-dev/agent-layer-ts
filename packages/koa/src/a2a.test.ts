import { describe, it, expect } from "vitest";
import Koa from "koa";
import Router from "@koa/router";
import request from "supertest";
import { a2aRoutes } from "./a2a.js";
import type { A2AConfig } from "@agent-layer/core";

const testConfig: A2AConfig = {
  card: {
    protocolVersion: "1.0.0",
    name: "test-agent",
    url: "https://example.com/agent",
    skills: [
      { id: "search", name: "Web Search" },
    ],
  },
};

function createApp(config: A2AConfig) {
  const app = new Koa();
  const router = new Router();
  const handlers = a2aRoutes(config);
  router.get("/.well-known/agent.json", handlers.agentCard);
  app.use(router.routes());
  return app.callback();
}

describe("a2aRoutes (Koa)", () => {
  it("serves agent card at /.well-known/agent.json", async () => {
    const app = createApp(testConfig);
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("test-agent");
    expect(res.body.protocolVersion).toBe("1.0.0");
    expect(res.body.skills).toHaveLength(1);
  });

  it("sets cache-control header", async () => {
    const app = createApp(testConfig);
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
  });

  it("includes default input/output modes", async () => {
    const app = createApp(testConfig);
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.body.defaultInputModes).toEqual(["text/plain"]);
    expect(res.body.defaultOutputModes).toEqual(["text/plain"]);
  });
});
