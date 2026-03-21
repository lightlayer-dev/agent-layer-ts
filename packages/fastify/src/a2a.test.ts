import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { a2aRoutes } from "./a2a.js";

describe("a2aRoutes (Fastify)", () => {
  it("serves /.well-known/agent.json with the agent card", async () => {
    const app = Fastify();
    await app.register(
      a2aRoutes({
        card: {
          protocolVersion: "1.0.0",
          name: "TestAgent",
          url: "https://example.com",
          skills: [{ id: "search", name: "Search" }],
        },
      }),
    );

    const res = await app.inject({
      method: "GET",
      url: "/.well-known/agent.json",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("TestAgent");
    expect(body.skills).toHaveLength(1);
    expect(body.skills[0].id).toBe("search");
  });

  it("sets cache-control header", async () => {
    const app = Fastify();
    await app.register(
      a2aRoutes({
        card: {
          protocolVersion: "1.0.0",
          name: "Agent",
          url: "https://example.com",
          skills: [],
        },
      }),
    );

    const res = await app.inject({
      method: "GET",
      url: "/.well-known/agent.json",
    });

    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
  });

  it("includes default input/output modes", async () => {
    const app = Fastify();
    await app.register(
      a2aRoutes({
        card: {
          protocolVersion: "1.0.0",
          name: "Agent",
          url: "https://example.com",
          skills: [],
        },
      }),
    );

    const res = await app.inject({
      method: "GET",
      url: "/.well-known/agent.json",
    });

    const body = res.json();
    expect(body.defaultInputModes).toEqual(["text/plain"]);
    expect(body.defaultOutputModes).toEqual(["text/plain"]);
  });
});
